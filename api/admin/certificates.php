<?php
header('X-Robots-Tag: noindex, nofollow', true);
/**
 * Vyomantra Technologies - Admin Certificates Management API
 * Create and list certificate verification records, and attach manually completed certificate files.
 * Protected by checkAdminAuth() guard.
 */

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/auth.php';

// Auth Guard - Only authorized admins can issue/modify certificates
$adminUser = checkAdminAuth();
$pdo = getDbConnection();

$action = trim($_POST['action'] ?? $_GET['action'] ?? 'list');

// Helper to load fallback certificates JSON
function getLocalCerts() {
    $jsonFile = __DIR__ . '/../../data/certificates.json';
    if (!file_exists($jsonFile)) {
        return [];
    }
    return json_decode(file_get_contents($jsonFile), true) ?: [];
}

// Helper to save fallback certificates JSON
function saveLocalCerts($certs) {
    $jsonFile = __DIR__ . '/../../data/certificates.json';
    $dir = dirname($jsonFile);
    if (!is_dir($dir)) {
        @mkdir($dir, 0755, true);
    }
    @file_put_contents($jsonFile, json_encode($certs, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));
}

// Allowed values (kept in sync with admin dashboard + certificate template)
const CERT_TYPES = ['Completion', 'Participation', 'Achievement', 'Internship', 'Excellence', 'Appreciation'];
const CERT_PROGRAM_TYPES = ['Training Program', 'Internship', 'Hackathon', 'Workshop', 'Webinar', 'Competition'];
const CERT_RECOGNITIONS = ['Completed', 'Participant', 'Winner', 'Runner-up', 'Intern', 'Volunteer'];

// ID prefix by program type: CRS, INT, HCK, EVT, WRK
function certPrefixForProgramType($programType) {
    $map = [
        'Training Program' => 'VYOM-CRS',
        'Internship'       => 'VYOM-INT',
        'Hackathon'        => 'VYOM-HCK',
        'Workshop'         => 'VYOM-WRK',
        'Webinar'          => 'VYOM-EVT',
        'Competition'      => 'VYOM-EVT'
    ];
    return $map[$programType] ?? 'VYOM-CRS';
}

// Helper to generate next Certificate ID in exact format: PREFIX-YYYY-NNNN (e.g. VYOM-CRS-2026-0001)
function generateNextCertificateId($pdo, $prefix, $year = null) {
    $prefix = strtoupper(trim($prefix ?: 'VYOM-CRS'));
    $year = (int)($year ?: date('Y'));
    $searchPattern = $prefix . '-' . $year . '-%';
    // Matcher matches PREFIX-YYYY-NNNN or legacy formats with random suffixes
    $matcher = '/^' . preg_quote($prefix . '-' . $year . '-', '/') . '(\d+)(?:-[A-Z0-9]{4})?$/';

    $maxSeq = 0;

    // Check DB
    if ($pdo) {
        try {
            $stmt = $pdo->prepare("SELECT certificate_id FROM certificates WHERE certificate_id LIKE :pat");
            $stmt->execute([':pat' => $searchPattern]);
            while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
                if (preg_match($matcher, $row['certificate_id'], $m)) {
                    $maxSeq = max($maxSeq, (int)$m[1]);
                }
            }
        } catch (\PDOException $e) {
            // fallback
        }
    }

    // Check JSON fallback
    $certs = getLocalCerts();
    foreach ($certs as $c) {
        if (preg_match($matcher, $c['certificate_id'] ?? '', $m)) {
            $maxSeq = max($maxSeq, (int)$m[1]);
        }
    }

    do {
        $maxSeq++;
        $newId = sprintf("%s-%04d-%04d", $prefix, $year, $maxSeq);
        $existsInDb = false;
        if ($pdo) {
            try {
                $check = $pdo->prepare("SELECT COUNT(*) FROM certificates WHERE certificate_id = :id");
                $check->execute([':id' => $newId]);
                $existsInDb = ((int)$check->fetchColumn() > 0);
            } catch (\PDOException $e) { /* fallback */ }
        }
        $existsInJson = false;
        foreach ($certs as $c) {
            if (($c['certificate_id'] ?? '') === $newId) { $existsInJson = true; break; }
        }
    } while ($existsInDb || $existsInJson);

    return $newId;
}

// =========================================================================
// 1. LIST CERTIFICATES
// =========================================================================
if ($action === 'list') {
    $search = trim($_GET['search'] ?? '');
    $status = trim($_GET['status'] ?? 'all');
    $type   = trim($_GET['type'] ?? 'all');
    $sort   = trim($_GET['sort'] ?? 'newest');
    $limit  = max(1, min(100, (int)($_GET['limit'] ?? 50)));
    $offset = max(0, (int)($_GET['offset'] ?? 0));

    $certificates = [];
    $total = 0;
    $counts = [
        'total'   => 0,
        'valid'   => 0,
        'revoked' => 0,
        'expired' => 0,
        'draft'   => 0
    ];

    if ($pdo) {
        try {
            $where = "WHERE 1=1";
            $params = [];

            if ($status !== 'all') {
                $where .= " AND status = :status";
                $params[':status'] = $status;
            }
            if ($type !== 'all') {
                $where .= " AND certificate_type = :type";
                $params[':type'] = $type;
            }
            if (!empty($search)) {
                $where .= " AND (certificate_id LIKE :s OR recipient_name LIKE :s OR recipient_email LIKE :s OR course_name LIKE :s)";
                $params[':s'] = "%$search%";
            }

            $orderClause = "ORDER BY created_at DESC";
            if ($sort === 'oldest') $orderClause = "ORDER BY created_at ASC";
            if ($sort === 'name')   $orderClause = "ORDER BY recipient_name ASC";
            if ($sort === 'id')     $orderClause = "ORDER BY certificate_id DESC";

            // Total count
            $cntStmt = $pdo->prepare("SELECT COUNT(*) FROM certificates $where");
            $cntStmt->execute($params);
            $total = (int)$cntStmt->fetchColumn();

            // Status breakdown counts
            $statStmt = $pdo->query("SELECT status, COUNT(*) as cnt FROM certificates GROUP BY status");
            while ($r = $statStmt->fetch(PDO::FETCH_ASSOC)) {
                $st = strtolower($r['status']);
                if (isset($counts[$st])) {
                    $counts[$st] = (int)$r['cnt'];
                }
                $counts['total'] += (int)$r['cnt'];
            }

            // Results
            $stmt = $pdo->prepare("SELECT * FROM certificates $where $orderClause LIMIT $limit OFFSET $offset");
            $stmt->execute($params);
            $certificates = $stmt->fetchAll(PDO::FETCH_ASSOC);

        } catch (\PDOException $e) {
            error_log("Certificates list query error: " . $e->getMessage());
        }
    }

    // If DB has no certificates or is not connected, use JSON fallback
    if (empty($certificates) && $total === 0) {
        $all = getLocalCerts();
        $counts['total'] = count($all);
        foreach ($all as $c) {
            $st = strtolower($c['status'] ?? 'valid');
            if (isset($counts[$st])) $counts[$st]++;
        }

        $filtered = array_filter($all, function($c) use ($status, $type, $search) {
            if ($status !== 'all' && ($c['status'] ?? '') !== $status) return false;
            if ($type !== 'all' && ($c['certificate_type'] ?? '') !== $type) return false;
            if (!empty($search)) {
                $needle = strtolower($search);
                $haystack = strtolower(($c['certificate_id'] ?? '') . ' ' . ($c['recipient_name'] ?? '') . ' ' . ($c['recipient_email'] ?? '') . ' ' . ($c['course_name'] ?? ''));
                if (strpos($haystack, $needle) === false) return false;
            }
            return true;
        });

        // Sorting
        usort($filtered, function($a, $b) use ($sort) {
            if ($sort === 'oldest') return strcmp($a['created_at'] ?? '', $b['created_at'] ?? '');
            if ($sort === 'name') return strcmp($a['recipient_name'] ?? '', $b['recipient_name'] ?? '');
            return strcmp($b['created_at'] ?? '', $a['created_at'] ?? '');
        });

        $total = count($filtered);
        $certificates = array_values(array_slice($filtered, $offset, $limit));
    }

    sendResponse(true, 'Certificates retrieved successfully', [
        'total'        => $total,
        'counts'       => $counts,
        'certificates' => $certificates
    ]);
}

// =========================================================================
// 3. CREATE CERTIFICATE
// =========================================================================
if ($action === 'create') {
    $recipientName        = trim($_POST['recipient_name'] ?? '');
    $recipientEmail       = trim($_POST['recipient_email'] ?? '');
    $certificateType      = trim($_POST['certificate_type'] ?? 'Completion');
    $programType          = trim($_POST['program_type'] ?? 'Training Program');
    $recognition          = trim($_POST['recognition'] ?? 'Completed');
    $prefix               = trim($_POST['prefix'] ?? '') ?: certPrefixForProgramType($programType);
    $courseName           = trim($_POST['course_name'] ?? '');
    $courseDuration       = trim($_POST['course_duration'] ?? '1 Month');
    $description          = trim($_POST['description'] ?? '');
    $trainerName          = trim($_POST['trainer_name'] ?? 'Santhosh S');
    $trainerDesignation   = trim($_POST['trainer_designation'] ?? 'Program Lead');
    $signatoryName        = trim($_POST['signatory_name'] ?? 'S.B. Sachin');
    $signatoryDesignation = trim($_POST['signatory_designation'] ?? 'Founder & CEO');
    $issueDate            = trim($_POST['issue_date'] ?? date('Y-m-d'));
    $completionDate       = trim($_POST['completion_date'] ?? $issueDate);
    $expiryDate           = trim($_POST['expiry_date'] ?? '') ?: null;
    $status               = in_array($_POST['status'] ?? '', ['valid', 'draft']) ? $_POST['status'] : 'valid';
    $privateNotes         = trim($_POST['private_notes'] ?? '');

    if (empty($recipientName) || empty($courseName)) {
        sendResponse(false, 'Recipient Full Name and Program / Event Name are mandatory.', [], 400);
    }
    if (!in_array($certificateType, CERT_TYPES, true) || !in_array($programType, CERT_PROGRAM_TYPES, true) || !in_array($recognition, CERT_RECOGNITIONS, true)) {
        sendResponse(false, 'Invalid certificate type, program type or recognition value.', [], 400);
    }
    if (!preg_match('/^[A-Z0-9-]{3,25}$/', strtoupper($prefix))) {
        sendResponse(false, 'Invalid ID prefix.', [], 400);
    }

    // Auto-generate unique Certificate ID
    $year = date('Y', strtotime($issueDate));
    $certificateId = generateNextCertificateId($pdo, $prefix, $year);

    // Auto-generate cryptographically secure token & verification URL
    $verificationToken = bin2hex(random_bytes(16));
    // QR / link carries the long random token, not the printed ID, so links cannot be guessed
    $verificationUrl   = SITE_URL . '/verify/?id=' . $verificationToken;

    $record = [
        'certificate_id'        => $certificateId,
        'certificate_type'      => $certificateType,
        'program_type'          => $programType,
        'recognition'           => $recognition,
        'prefix'                => $prefix,
        'recipient_name'        => $recipientName,
        'recipient_email'       => $recipientEmail,
        'course_name'           => $courseName,
        'course_duration'       => $courseDuration,
        'description'           => $description,
        'trainer_name'          => $trainerName,
        'trainer_designation'   => $trainerDesignation,
        'signatory_name'        => $signatoryName,
        'signatory_designation' => $signatoryDesignation,
        'issue_date'            => $issueDate,
        'completion_date'       => $completionDate,
        'expiry_date'           => $expiryDate,
        'status'                => $status,
        'verification_token'    => $verificationToken,
        'verification_url'      => $verificationUrl,
        'qr_code_url'           => null,
        'certificate_pdf_url'   => null,
        'final_docx_url'        => null,
        'template_id'           => '1month_python_course',
        'issued_by'             => 'VYOMANTRA TECHNOLOGIES',
        'private_notes'         => $privateNotes,
        'revoked_at'            => null,
        'revoked_by'            => null,
        'revocation_reason'     => null,
        'created_at'            => date('Y-m-d H:i:s'),
        'updated_at'            => date('Y-m-d H:i:s')
    ];

    $newId = 0;

    if ($pdo) {
        try {
            $stmt = $pdo->prepare("
                INSERT INTO certificates (
                    certificate_id, certificate_type, program_type, recognition, prefix, recipient_name, recipient_email,
                    course_name, course_duration, description, trainer_name, trainer_designation,
                    signatory_name, signatory_designation, issue_date, completion_date, expiry_date,
                    status, verification_token, verification_url, template_id, issued_by, private_notes,
                    created_at, updated_at
                ) VALUES (
                    :cid, :ctype, :ptype, :recog, :prefix, :rname, :remail,
                    :cname, :cdur, :desc, :tname, :tdesig,
                    :sname, :sdesig, :idate, :cdate, :edate,
                    :status, :token, :vurl, :tempid, :issuedby, :pnotes,
                    NOW(), NOW()
                )
            ");
            $stmt->execute([
                ':cid'      => $certificateId,
                ':ctype'    => $certificateType,
                ':ptype'    => $programType,
                ':recog'    => $recognition,
                ':prefix'   => $prefix,
                ':rname'    => $recipientName,
                ':remail'   => $recipientEmail,
                ':cname'    => $courseName,
                ':cdur'     => $courseDuration,
                ':desc'     => $description,
                ':tname'    => $trainerName,
                ':tdesig'   => $trainerDesignation,
                ':sname'    => $signatoryName,
                ':sdesig'   => $signatoryDesignation,
                ':idate'    => $issueDate,
                ':cdate'    => $completionDate,
                ':edate'    => $expiryDate,
                ':status'   => $status,
                ':token'    => $verificationToken,
                ':vurl'     => $verificationUrl,
                ':tempid'   => '1month_python_course',
                ':issuedby' => 'VYOMANTRA TECHNOLOGIES',
                ':pnotes'   => $privateNotes
            ]);
            $newId = (int)$pdo->lastInsertId();
            $record['id'] = $newId;
        } catch (\PDOException $e) {
            error_log("Create certificate DB error: " . $e->getMessage());
        }
    }

    // Always update JSON fallback
    $certs = getLocalCerts();
    if (!$newId) {
        $record['id'] = count($certs) + 1;
    }
    array_unshift($certs, $record);
    saveLocalCerts($certs);

    sendResponse(true, "Certificate $certificateId created successfully.", [
        'certificate' => $record
    ], 201);
}

// =========================================================================
// REVOKE / REINSTATE (file is kept; public access is blocked while revoked)
// =========================================================================
if ($action === 'revoke' || $action === 'reinstate') {
    $cid = trim($_POST['certificate_id'] ?? '');
    $reason = trim($_POST['reason'] ?? '');
    if ($cid === '') sendResponse(false, 'Certificate ID is required.', [], 400);
    if ($action === 'revoke' && $reason === '') sendResponse(false, 'Please enter a reason for revoking.', [], 400);

    $newStatus = $action === 'revoke' ? 'revoked' : 'valid';
    $adminName = is_array($adminUser ?? null) ? (string)($adminUser['username'] ?? 'admin') : 'admin';
    $found = false;

    if ($pdo) {
        try {
            if ($action === 'revoke') {
                $st = $pdo->prepare("UPDATE certificates SET status='revoked', revoked_at=NOW(), revoked_by=:by, revocation_reason=:why, updated_at=NOW() WHERE certificate_id=:cid");
                $st->execute([':by' => $adminName, ':why' => $reason, ':cid' => $cid]);
            } else {
                $st = $pdo->prepare("UPDATE certificates SET status='valid', revoked_at=NULL, revoked_by=NULL, revocation_reason=NULL, updated_at=NOW() WHERE certificate_id=:cid");
                $st->execute([':cid' => $cid]);
            }
            $found = $st->rowCount() > 0;
        } catch (\PDOException $e) {
            error_log('Revoke/reinstate DB error: ' . $e->getMessage());
        }
    }

    $records = getLocalCerts();
    foreach ($records as &$rec) {
        if (($rec['certificate_id'] ?? '') === $cid) {
            $rec['status'] = $newStatus;
            $rec['revoked_at'] = $action === 'revoke' ? date('Y-m-d H:i:s') : null;
            $rec['revoked_by'] = $action === 'revoke' ? $adminName : null;
            $rec['revocation_reason'] = $action === 'revoke' ? $reason : null;
            $rec['updated_at'] = date('Y-m-d H:i:s');
            $found = true;
        }
    }
    unset($rec);
    saveLocalCerts($records);

    if (!$found) sendResponse(false, 'Certificate record not found.', [], 404);
    sendResponse(true, "Certificate $cid is now $newStatus.", ['certificate_id' => $cid, 'status' => $newStatus]);
}

// =========================================================================
// DELETE CERTIFICATE (Permanently remove verification record & attached files)
// =========================================================================
if ($action === 'delete') {
    $cid = trim($_POST['certificate_id'] ?? $_POST['id'] ?? '');
    if ($cid === '') {
        sendResponse(false, 'Certificate ID is required for deletion.', [], 400);
    }

    $deleted = false;

    // 1. Delete from MySQL database if connected
    if ($pdo) {
        try {
            $st = $pdo->prepare("DELETE FROM certificates WHERE certificate_id = :cid OR id = :id");
            $st->execute([':cid' => $cid, ':id' => $cid]);
            if ($st->rowCount() > 0) {
                $deleted = true;
            }
        } catch (\PDOException $e) {
            error_log('Certificate delete DB error: ' . $e->getMessage());
        }
    }

    // 2. Delete from local JSON fallback if present
    $records = getLocalCerts();
    $origCount = count($records);
    $records = array_values(array_filter($records, function ($c) use ($cid) {
        return ($c['certificate_id'] ?? '') !== $cid && (string)($c['id'] ?? '') !== $cid;
    }));
    if (count($records) < $origCount) {
        saveLocalCerts($records);
        $deleted = true;
    }

    // 3. Remove any attached files (.pdf, .docx) from uploads directory
    $safeId = preg_replace('/[^A-Za-z0-9_-]/', '_', $cid);
    $certDir = dirname(__DIR__, 2) . '/uploads/certificates';
    $filesToClean = [
        $certDir . '/' . $safeId . '_final.pdf',
        $certDir . '/' . $safeId . '_final.docx',
        $certDir . '/' . $safeId . '.pdf',
        $certDir . '/' . $safeId . '.docx',
    ];
    foreach ($filesToClean as $file) {
        if (file_exists($file)) {
            @unlink($file);
        }
    }

    if (!$deleted) {
        sendResponse(false, "Certificate record $cid not found or already deleted.", [], 404);
    }

    sendResponse(true, "Certificate $cid has been permanently deleted.", ['certificate_id' => $cid]);
}

// =========================================================================
// Attach the manually completed DOCX and publish its converted PDF on verification.
if ($action === 'upload_final_docx') {
    $id = trim($_POST['id'] ?? '');
    $upload = $_FILES['final_docx'] ?? null;
    if ($id === '' || !$upload || ($upload['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
        sendResponse(false, 'Choose a final DOCX file for a valid certificate record.', [], 400);
    }
    if (($upload['size'] ?? 0) < 1 || $upload['size'] > 20 * 1024 * 1024 || strtolower(pathinfo($upload['name'] ?? '', PATHINFO_EXTENSION)) !== 'docx') {
        sendResponse(false, 'The final certificate must be a DOCX file smaller than 20 MB.', [], 400);
    }

    $certificate = null;
    if ($pdo) {
        try {
            $stmt = $pdo->prepare('SELECT * FROM certificates WHERE certificate_id = :cid OR id = :id LIMIT 1');
            $stmt->execute([':cid' => $id, ':id' => $id]);
            $certificate = $stmt->fetch(PDO::FETCH_ASSOC) ?: null;
        } catch (\PDOException $e) {
            sendResponse(false, 'Could not load the certificate record.', [], 500);
        }
    }
    if (!$certificate) {
        foreach (getLocalCerts() as $record) {
            if (($record['certificate_id'] ?? '') === $id || (string)($record['id'] ?? '') === $id) { $certificate = $record; break; }
        }
    }
    if (!$certificate) sendResponse(false, 'Certificate record not found.', [], 404);

    $soffice = trim((string)(getenv('CERTIFICATE_SOFFICE_BIN') ?: ''));
    if ($soffice === '') {
        foreach (['/usr/bin/soffice', '/usr/local/bin/soffice', '/usr/bin/libreoffice'] as $candidate) {
            if (is_executable($candidate)) { $soffice = $candidate; break; }
        }
    }
    if ($soffice === '' || !is_executable($soffice) || !function_exists('proc_open')) {
        // LibreOffice not available: store the DOCX directly as the certificate file.
        // Public download will serve the DOCX (via api/download.php which accepts both PDF and DOCX).
        $certificateId = (string)($certificate['certificate_id'] ?? $id);
        $safeId    = preg_replace('/[^A-Za-z0-9_-]/', '_', $certificateId);
        $targetDir = dirname(__DIR__, 2) . '/uploads/certificates';
        if (!is_dir($targetDir) && !@mkdir($targetDir, 0755, true)) sendResponse(false, 'Could not prepare certificate storage.', [], 500);
        $fileName = $safeId . '_final.docx';
        $destPath = $targetDir . '/' . $fileName;
        if (!move_uploaded_file($upload['tmp_name'], $destPath)) sendResponse(false, 'Could not save the DOCX file.', [], 500);
        $fileUrl = rtrim(SITE_URL, '/') . '/uploads/certificates/' . rawurlencode($fileName);
        if ($pdo) {
            try {
                $update = $pdo->prepare('UPDATE certificates SET certificate_pdf_url = :url, updated_at = NOW() WHERE certificate_id = :cid');
                $update->execute([':url' => $fileUrl, ':cid' => $certificateId]);
            } catch (\PDOException $e) {}
        }
        $recs = getLocalCerts();
        foreach ($recs as &$r) {
            if (($r['certificate_id'] ?? '') === $certificateId) { $r['certificate_pdf_url'] = $fileUrl; $r['updated_at'] = date('Y-m-d H:i:s'); }
        }
        unset($r);
        saveLocalCerts($recs);
        sendResponse(true, 'DOCX uploaded and attached (PDF conversion unavailable on this server; DOCX will be served for download).', [
            'certificate_id' => $certificateId, 'certificate_pdf_url' => $fileUrl,
        ]);
    }

    $zip = new ZipArchive();
    if ($zip->open($upload['tmp_name']) !== true || $zip->locateName('word/document.xml') === false) {
        if ($zip->status === ZipArchive::ER_OK) $zip->close();
        sendResponse(false, 'The uploaded file is not a valid Word DOCX document.', [], 400);
    }
    $zip->close();

    $certificateId = (string)$certificate['certificate_id'];
    $safeId = preg_replace('/[^A-Za-z0-9_-]/', '_', $certificateId);
    $targetDir = dirname(__DIR__, 2) . '/uploads/certificates';
    if (!is_dir($targetDir) && !@mkdir($targetDir, 0755, true)) sendResponse(false, 'Could not prepare certificate storage.', [], 500);
    $workDir = sys_get_temp_dir() . '/vyomantra-cert-' . bin2hex(random_bytes(8));
    if (!@mkdir($workDir, 0700, true)) sendResponse(false, 'Could not prepare the DOCX conversion workspace.', [], 500);

    $docxPath = $workDir . '/' . $safeId . '.docx';
    $pdfPath = $workDir . '/' . $safeId . '.pdf';
    $profilePath = $workDir . '/lo-profile';
    @mkdir($profilePath, 0700, true);
    $conversionResult = null;
    $conversionError = null;
    try {
        if (!move_uploaded_file($upload['tmp_name'], $docxPath)) throw new RuntimeException('Could not save the uploaded DOCX.');
        $command = [$soffice, '--headless', '-env:UserInstallation=file://' . $profilePath, '--convert-to', 'pdf:writer_pdf_Export', '--outdir', $workDir, $docxPath];
        $process = proc_open($command, [1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes, null, null, ['bypass_shell' => true]);
        if (!is_resource($process)) throw new RuntimeException('Could not start the document converter.');
        $stdout = stream_get_contents($pipes[1]); fclose($pipes[1]);
        $stderr = stream_get_contents($pipes[2]); fclose($pipes[2]);
        $exitCode = proc_close($process);
        if ($exitCode !== 0 || !is_file($pdfPath) || filesize($pdfPath) < 100) {
            throw new RuntimeException('The DOCX could not be converted to PDF. ' . trim((string)$stderr . ' ' . (string)$stdout));
        }

        $pdfName = $safeId . '_final.pdf';
        $storedPdf = $targetDir . '/' . $pdfName;
        if (!@copy($pdfPath, $storedPdf)) throw new RuntimeException('Converted PDF could not be stored.');
        $pdfUrl = rtrim(SITE_URL, '/') . '/uploads/certificates/' . rawurlencode($pdfName);

        if ($pdo) {
            $update = $pdo->prepare('UPDATE certificates SET certificate_pdf_url = :pdf, updated_at = NOW() WHERE certificate_id = :cid');
            $update->execute([':pdf' => $pdfUrl, ':cid' => $certificateId]);
        }
        $records = getLocalCerts();
        foreach ($records as &$record) {
            if (($record['certificate_id'] ?? '') === $certificateId) {
                $record['certificate_pdf_url'] = $pdfUrl;
                $record['updated_at'] = date('Y-m-d H:i:s');
            }
        }
        unset($record);
        saveLocalCerts($records);
        $conversionResult = [
            'certificate_id' => $certificateId,
            'certificate_pdf_url' => $pdfUrl
        ];
    } catch (\Throwable $e) {
        error_log('Final certificate conversion failed: ' . $e->getMessage());
        $conversionError = $e->getMessage();
    } finally {
        $removeTree = static function (string $path) use (&$removeTree): void {
            if (is_dir($path) && !is_link($path)) {
                foreach (scandir($path) ?: [] as $entry) {
                    if ($entry !== '.' && $entry !== '..') $removeTree($path . DIRECTORY_SEPARATOR . $entry);
                }
                @rmdir($path);
            } else {
                @unlink($path);
            }
        };
        $removeTree($workDir);
        @rmdir($workDir);
    }
    if ($conversionError !== null) sendResponse(false, $conversionError, [], 500);
    sendResponse(true, 'Final DOCX uploaded and converted to PDF.', $conversionResult);
}

// =========================================================================
// Direct upload: store .pdf or .docx as-is (no LibreOffice needed).
// Works on all shared hosting. Served via api/download.php for public download.
// =========================================================================
if ($action === 'upload_final_pdf') {
    $id     = trim($_POST['id'] ?? '');
    $upload = $_FILES['final_pdf'] ?? $_FILES['final_docx'] ?? null;
    if ($id === '' || !$upload || ($upload['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
        sendResponse(false, 'Choose a PDF or DOCX file for a valid certificate record.', [], 400);
    }
    $ext = strtolower(pathinfo($upload['name'] ?? '', PATHINFO_EXTENSION));
    if (!in_array($ext, ['pdf', 'docx'], true)) {
        sendResponse(false, 'Only PDF and DOCX files are accepted.', [], 400);
    }
    if (($upload['size'] ?? 0) < 1 || $upload['size'] > 20 * 1024 * 1024) {
        sendResponse(false, 'File must be smaller than 20 MB.', [], 400);
    }

    $certificate = null;
    if ($pdo) {
        try {
            $stmt = $pdo->prepare('SELECT * FROM certificates WHERE certificate_id = :cid OR id = :id LIMIT 1');
            $stmt->execute([':cid' => $id, ':id' => $id]);
            $certificate = $stmt->fetch(PDO::FETCH_ASSOC) ?: null;
        } catch (\PDOException $e) {
            sendResponse(false, 'Could not load the certificate record.', [], 500);
        }
    }
    if (!$certificate) {
        foreach (getLocalCerts() as $record) {
            if (($record['certificate_id'] ?? '') === $id || (string)($record['id'] ?? '') === $id) { $certificate = $record; break; }
        }
    }
    if (!$certificate) sendResponse(false, 'Certificate record not found.', [], 404);

    $certificateId = (string)$certificate['certificate_id'];
    $safeId   = preg_replace('/[^A-Za-z0-9_-]/', '_', $certificateId);
    $targetDir = dirname(__DIR__, 2) . '/uploads/certificates';
    if (!is_dir($targetDir) && !@mkdir($targetDir, 0755, true)) sendResponse(false, 'Could not prepare certificate storage.', [], 500);

    $fileName = $safeId . '_final.' . $ext;
    $destPath = $targetDir . '/' . $fileName;
    if (!move_uploaded_file($upload['tmp_name'], $destPath)) sendResponse(false, 'Could not save the uploaded file.', [], 500);

    $fileUrl = rtrim(SITE_URL, '/') . '/uploads/certificates/' . rawurlencode($fileName);
    if ($pdo) {
        try {
            $update = $pdo->prepare('UPDATE certificates SET certificate_pdf_url = :url, updated_at = NOW() WHERE certificate_id = :cid');
            $update->execute([':url' => $fileUrl, ':cid' => $certificateId]);
        } catch (\PDOException $e) {}
    }
    $records = getLocalCerts();
    foreach ($records as &$record) {
        if (($record['certificate_id'] ?? '') === $certificateId) {
            $record['certificate_pdf_url'] = $fileUrl;
            $record['updated_at'] = date('Y-m-d H:i:s');
        }
    }
    unset($record);
    saveLocalCerts($records);
    sendResponse(true, strtoupper($ext) . ' file uploaded and attached to the certificate.', [
        'certificate_id'      => $certificateId,
        'certificate_pdf_url' => $fileUrl,
    ]);
}

sendResponse(false, 'Invalid certificate action specified.', [], 400);
