<?php
header('X-Robots-Tag: noindex, nofollow', true);
/**
 * Vyomantra Technologies - Admin Certificates Management API
 * Full CRUD, unique Certificate ID generation, revocation, restore, audit logs, and bulk CSV generation.
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

// Helper to generate next unique collision-safe Certificate ID
function generateNextCertificateId($pdo, $prefix, $year) {
    $prefix = strtoupper(trim($prefix ?: 'VYOM-CRT'));
    $year = (int)($year ?: date('Y'));
    $searchPattern = $prefix . '-' . $year . '-%';

    $maxSeq = 0;

    // Check DB
    if ($pdo) {
        try {
            $stmt = $pdo->prepare("SELECT certificate_id FROM certificates WHERE certificate_id LIKE :pat ORDER BY id DESC");
            $stmt->execute([':pat' => $searchPattern]);
            while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
                $parts = explode('-', $row['certificate_id']);
                $seq = (int)end($parts);
                if ($seq > $maxSeq) {
                    $maxSeq = $seq;
                }
            }
        } catch (\PDOException $e) {
            // fallback
        }
    }

    // Check JSON fallback
    $certs = getLocalCerts();
    foreach ($certs as $c) {
        $cid = $c['certificate_id'] ?? '';
        if (strpos($cid, $prefix . '-' . $year . '-') === 0) {
            $parts = explode('-', $cid);
            $seq = (int)end($parts);
            if ($seq > $maxSeq) {
                $maxSeq = $seq;
            }
        }
    }

    // Generate collision-safe ID
    do {
        $maxSeq++;
        $newId = sprintf("%s-%04d-%05d", $prefix, $year, $maxSeq);
        // Ensure absolutely unique
        $existsInDb = false;
        if ($pdo) {
            $check = $pdo->prepare("SELECT COUNT(*) FROM certificates WHERE certificate_id = :id");
            $check->execute([':id' => $newId]);
            $existsInDb = ((int)$check->fetchColumn() > 0);
        }
        $existsInJson = false;
        foreach ($certs as $c) {
            if (($c['certificate_id'] ?? '') === $newId) {
                $existsInJson = true;
                break;
            }
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
// 2. GET SINGLE CERTIFICATE WITH AUDIT LOGS
// =========================================================================
if ($action === 'get') {
    $id = trim($_GET['id'] ?? $_POST['id'] ?? '');
    if (empty($id)) {
        sendResponse(false, 'Certificate ID is required.', [], 400);
    }

    $certificate = null;
    $logs = [];

    if ($pdo) {
        try {
            $stmt = $pdo->prepare("SELECT * FROM certificates WHERE id = :id OR certificate_id = :cid LIMIT 1");
            $stmt->execute([':id' => is_numeric($id) ? (int)$id : 0, ':cid' => $id]);
            $certificate = $stmt->fetch(PDO::FETCH_ASSOC);

            if ($certificate) {
                $logStmt = $pdo->prepare("SELECT * FROM certificate_logs WHERE certificate_id = :cid ORDER BY verification_timestamp DESC LIMIT 50");
                $logStmt->execute([':cid' => $certificate['certificate_id']]);
                $logs = $logStmt->fetchAll(PDO::FETCH_ASSOC);
            }
        } catch (\PDOException $e) {
            error_log("Get certificate error: " . $e->getMessage());
        }
    }

    if (!$certificate) {
        $certs = getLocalCerts();
        foreach ($certs as $c) {
            if (($c['id'] ?? '') == $id || ($c['certificate_id'] ?? '') === $id) {
                $certificate = $c;
                break;
            }
        }

        $logFile = __DIR__ . '/../../data/certificate_logs.json';
        if (file_exists($logFile) && $certificate) {
            $allLogs = json_decode(file_get_contents($logFile), true) ?: [];
            foreach ($allLogs as $l) {
                if (($l['certificate_id'] ?? '') === $certificate['certificate_id']) {
                    $logs[] = $l;
                }
            }
        }
    }

    if (!$certificate) {
        sendResponse(false, 'Certificate not found.', [], 404);
    }

    sendResponse(true, 'Certificate details retrieved', [
        'certificate' => $certificate,
        'logs'        => $logs
    ]);
}

// =========================================================================
// 3. CREATE CERTIFICATE
// =========================================================================
if ($action === 'create') {
    $recipientName        = trim($_POST['recipient_name'] ?? '');
    $recipientEmail       = trim($_POST['recipient_email'] ?? '');
    $certificateType      = trim($_POST['certificate_type'] ?? 'Course Completion');
    $prefix               = trim($_POST['prefix'] ?? 'VYOM-CRT');
    $courseName           = trim($_POST['course_name'] ?? '');
    $courseDuration       = trim($_POST['course_duration'] ?? '3 Months');
    $description          = trim($_POST['description'] ?? '');
    $trainerName          = trim($_POST['trainer_name'] ?? 'Santhosh S');
    $trainerDesignation   = trim($_POST['trainer_designation'] ?? 'Lead Technical Instructor');
    $signatoryName        = trim($_POST['signatory_name'] ?? 'S.B. Sachin');
    $signatoryDesignation = trim($_POST['signatory_designation'] ?? 'Founder & CEO');
    $issueDate            = trim($_POST['issue_date'] ?? date('Y-m-d'));
    $completionDate       = trim($_POST['completion_date'] ?? $issueDate);
    $expiryDate           = trim($_POST['expiry_date'] ?? '') ?: null;
    $status               = in_array($_POST['status'] ?? '', ['valid', 'draft']) ? $_POST['status'] : 'valid';
    $privateNotes         = trim($_POST['private_notes'] ?? '');

    if (empty($recipientName) || empty($courseName)) {
        sendResponse(false, 'Recipient Full Name and Course/Program Name are mandatory.', [], 400);
    }

    // Auto-generate unique Certificate ID
    $year = date('Y', strtotime($issueDate));
    $certificateId = generateNextCertificateId($pdo, $prefix, $year);

    // Auto-generate cryptographically secure token & verification URL
    $verificationToken = bin2hex(random_bytes(16));
    $verificationUrl   = SITE_URL . '/verify/?id=' . urlencode($certificateId);

    $record = [
        'certificate_id'        => $certificateId,
        'certificate_type'      => $certificateType,
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
        'template_id'           => 'vyomantra_premium_v1',
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
                    certificate_id, certificate_type, prefix, recipient_name, recipient_email,
                    course_name, course_duration, description, trainer_name, trainer_designation,
                    signatory_name, signatory_designation, issue_date, completion_date, expiry_date,
                    status, verification_token, verification_url, template_id, issued_by, private_notes,
                    created_at, updated_at
                ) VALUES (
                    :cid, :ctype, :prefix, :rname, :remail,
                    :cname, :cdur, :desc, :tname, :tdesig,
                    :sname, :sdesig, :idate, :cdate, :edate,
                    :status, :token, :vurl, :tempid, :issuedby, :pnotes,
                    NOW(), NOW()
                )
            ");
            $stmt->execute([
                ':cid'      => $certificateId,
                ':ctype'    => $certificateType,
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
                ':tempid'   => 'vyomantra_premium_v1',
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
// 4. UPDATE CERTIFICATE
// =========================================================================
if ($action === 'update') {
    $id = trim($_POST['id'] ?? '');
    if (empty($id)) {
        sendResponse(false, 'Certificate ID is required for update.', [], 400);
    }

    $recipientName        = trim($_POST['recipient_name'] ?? '');
    $recipientEmail       = trim($_POST['recipient_email'] ?? '');
    $certificateType      = trim($_POST['certificate_type'] ?? 'Course Completion');
    $courseName           = trim($_POST['course_name'] ?? '');
    $courseDuration       = trim($_POST['course_duration'] ?? '3 Months');
    $description          = trim($_POST['description'] ?? '');
    $trainerName          = trim($_POST['trainer_name'] ?? 'Santhosh S');
    $trainerDesignation   = trim($_POST['trainer_designation'] ?? 'Lead Technical Instructor');
    $signatoryName        = trim($_POST['signatory_name'] ?? 'S.B. Sachin');
    $signatoryDesignation = trim($_POST['signatory_designation'] ?? 'Founder & CEO');
    $issueDate            = trim($_POST['issue_date'] ?? date('Y-m-d'));
    $completionDate       = trim($_POST['completion_date'] ?? $issueDate);
    $expiryDate           = trim($_POST['expiry_date'] ?? '') ?: null;
    $privateNotes         = trim($_POST['private_notes'] ?? '');

    if ($pdo) {
        try {
            $stmt = $pdo->prepare("
                UPDATE certificates SET
                    recipient_name = :rname,
                    recipient_email = :remail,
                    certificate_type = :ctype,
                    course_name = :cname,
                    course_duration = :cdur,
                    description = :desc,
                    trainer_name = :tname,
                    trainer_designation = :tdesig,
                    signatory_name = :sname,
                    signatory_designation = :sdesig,
                    issue_date = :idate,
                    completion_date = :cdate,
                    expiry_date = :edate,
                    private_notes = :pnotes,
                    updated_at = NOW()
                WHERE id = :id OR certificate_id = :cid
            ");
            $stmt->execute([
                ':rname'   => $recipientName,
                ':remail'  => $recipientEmail,
                ':ctype'   => $certificateType,
                ':cname'   => $courseName,
                ':cdur'    => $courseDuration,
                ':desc'    => $description,
                ':tname'   => $trainerName,
                ':tdesig'  => $trainerDesignation,
                ':sname'   => $signatoryName,
                ':sdesig'  => $signatoryDesignation,
                ':idate'   => $issueDate,
                ':cdate'   => $completionDate,
                ':edate'   => $expiryDate,
                ':pnotes'  => $privateNotes,
                ':id'      => is_numeric($id) ? (int)$id : 0,
                ':cid'     => $id
            ]);
        } catch (\PDOException $e) {
            error_log("Update certificate DB error: " . $e->getMessage());
        }
    }

    // Sync JSON fallback
    $certs = getLocalCerts();
    foreach ($certs as &$c) {
        if (($c['id'] ?? '') == $id || ($c['certificate_id'] ?? '') === $id) {
            $c['recipient_name']        = $recipientName;
            $c['recipient_email']       = $recipientEmail;
            $c['certificate_type']      = $certificateType;
            $c['course_name']           = $courseName;
            $c['course_duration']       = $courseDuration;
            $c['description']           = $description;
            $c['trainer_name']          = $trainerName;
            $c['trainer_designation']   = $trainerDesignation;
            $c['signatory_name']        = $signatoryName;
            $c['signatory_designation'] = $signatoryDesignation;
            $c['issue_date']            = $issueDate;
            $c['completion_date']       = $completionDate;
            $c['expiry_date']           = $expiryDate;
            $c['private_notes']         = $privateNotes;
            $c['updated_at']            = date('Y-m-d H:i:s');
            break;
        }
    }
    saveLocalCerts($certs);

    sendResponse(true, "Certificate $id updated successfully.");
}

// =========================================================================
// 5. REVOKE CERTIFICATE
// =========================================================================
if ($action === 'revoke') {
    $id = trim($_POST['id'] ?? '');
    $reason = trim($_POST['reason'] ?? 'Revoked by Issuing Authority');
    $revokedBy = $adminUser['username'] ?? 'Administrator';

    if (empty($id)) {
        sendResponse(false, 'Certificate ID is required for revocation.', [], 400);
    }

    if ($pdo) {
        try {
            $stmt = $pdo->prepare("
                UPDATE certificates SET
                    status = 'revoked',
                    revoked_at = NOW(),
                    revoked_by = :by,
                    revocation_reason = :reason,
                    updated_at = NOW()
                WHERE id = :id OR certificate_id = :cid
            ");
            $stmt->execute([
                ':by'     => $revokedBy,
                ':reason' => $reason,
                ':id'     => is_numeric($id) ? (int)$id : 0,
                ':cid'    => $id
            ]);
        } catch (\PDOException $e) {
            error_log("Revoke certificate DB error: " . $e->getMessage());
        }
    }

    // Sync JSON fallback
    $certs = getLocalCerts();
    foreach ($certs as &$c) {
        if (($c['id'] ?? '') == $id || ($c['certificate_id'] ?? '') === $id) {
            $c['status']            = 'revoked';
            $c['revoked_at']        = date('Y-m-d H:i:s');
            $c['revoked_by']        = $revokedBy;
            $c['revocation_reason'] = $reason;
            $c['updated_at']        = date('Y-m-d H:i:s');
            break;
        }
    }
    saveLocalCerts($certs);

    sendResponse(true, "Certificate $id has been revoked successfully.");
}

// =========================================================================
// 6. RESTORE CERTIFICATE
// =========================================================================
if ($action === 'restore') {
    $id = trim($_POST['id'] ?? '');

    if (empty($id)) {
        sendResponse(false, 'Certificate ID is required.', [], 400);
    }

    if ($pdo) {
        try {
            $stmt = $pdo->prepare("
                UPDATE certificates SET
                    status = 'valid',
                    revoked_at = NULL,
                    revoked_by = NULL,
                    revocation_reason = NULL,
                    updated_at = NOW()
                WHERE id = :id OR certificate_id = :cid
            ");
            $stmt->execute([
                ':id'  => is_numeric($id) ? (int)$id : 0,
                ':cid' => $id
            ]);
        } catch (\PDOException $e) {
            error_log("Restore certificate DB error: " . $e->getMessage());
        }
    }

    // Sync JSON fallback
    $certs = getLocalCerts();
    foreach ($certs as &$c) {
        if (($c['id'] ?? '') == $id || ($c['certificate_id'] ?? '') === $id) {
            $c['status']            = 'valid';
            $c['revoked_at']        = null;
            $c['revoked_by']        = null;
            $c['revocation_reason'] = null;
            $c['updated_at']        = date('Y-m-d H:i:s');
            break;
        }
    }
    saveLocalCerts($certs);

    sendResponse(true, "Certificate $id has been restored to VALID status.");
}

// =========================================================================
// 7. DELETE / ARCHIVE CERTIFICATE
// =========================================================================
if ($action === 'delete') {
    $id = trim($_POST['id'] ?? '');

    if (empty($id)) {
        sendResponse(false, 'Certificate ID is required.', [], 400);
    }

    if ($pdo) {
        try {
            $stmt = $pdo->prepare("DELETE FROM certificates WHERE id = :id OR certificate_id = :cid");
            $stmt->execute([
                ':id'  => is_numeric($id) ? (int)$id : 0,
                ':cid' => $id
            ]);
        } catch (\PDOException $e) {
            error_log("Delete certificate DB error: " . $e->getMessage());
        }
    }

    // Sync JSON fallback
    $certs = getLocalCerts();
    $certs = array_values(array_filter($certs, function($c) use ($id) {
        return !(($c['id'] ?? '') == $id || ($c['certificate_id'] ?? '') === $id);
    }));
    saveLocalCerts($certs);

    sendResponse(true, "Certificate $id deleted successfully.");
}

// =========================================================================
// 8. BULK IMPORT / ISSUE (CSV / JSON)
// =========================================================================
if ($action === 'bulk_import') {
    $recordsJson = trim($_POST['records'] ?? '');
    $records = [];

    if (!empty($recordsJson)) {
        $records = json_decode($recordsJson, true) ?: [];
    }

    // Alternatively parse uploaded CSV file
    if (empty($records) && isset($_FILES['csv_file']) && $_FILES['csv_file']['error'] === UPLOAD_ERR_OK) {
        $handle = fopen($_FILES['csv_file']['tmp_name'], 'r');
        $header = fgetcsv($handle);
        while (($row = fgetcsv($handle)) !== false) {
            if (empty($row[0])) continue;
            $records[] = [
                'recipient_name'   => trim($row[0] ?? ''),
                'recipient_email'  => trim($row[1] ?? ''),
                'course_name'      => trim($row[2] ?? 'Full Stack Development'),
                'course_duration'  => trim($row[3] ?? '3 Months'),
                'issue_date'       => trim($row[4] ?? date('Y-m-d')),
                'certificate_type' => trim($row[5] ?? 'Course Completion'),
                'prefix'           => trim($row[6] ?? 'VYOM-CRT')
            ];
        }
        fclose($handle);
    }

    if (empty($records)) {
        sendResponse(false, 'No valid records provided for bulk certificate generation.', [], 400);
    }

    $createdList = [];
    $allLocal = getLocalCerts();

    foreach ($records as $r) {
        $recipientName = trim($r['recipient_name'] ?? '');
        $courseName    = trim($r['course_name'] ?? '');
        if (empty($recipientName) || empty($courseName)) continue;

        $prefix   = strtoupper(trim($r['prefix'] ?? 'VYOM-CRT'));
        $issueDate = trim($r['issue_date'] ?? date('Y-m-d'));
        $year      = date('Y', strtotime($issueDate));
        $certId    = generateNextCertificateId($pdo, $prefix, $year);
        $token     = bin2hex(random_bytes(16));
        $vurl      = SITE_URL . '/verify/?id=' . urlencode($certId);

        $item = [
            'id'                    => count($allLocal) + 1,
            'certificate_id'        => $certId,
            'certificate_type'      => trim($r['certificate_type'] ?? 'Course Completion'),
            'prefix'                => $prefix,
            'recipient_name'        => $recipientName,
            'recipient_email'       => trim($r['recipient_email'] ?? ''),
            'course_name'           => $courseName,
            'course_duration'       => trim($r['course_duration'] ?? '3 Months'),
            'description'           => trim($r['description'] ?? 'Successfully completed official program curriculum with excellence.'),
            'trainer_name'          => trim($r['trainer_name'] ?? 'Santhosh S'),
            'trainer_designation'   => trim($r['trainer_designation'] ?? 'Lead Technical Instructor'),
            'signatory_name'        => 'S.B. Sachin',
            'signatory_designation' => 'Founder & CEO',
            'issue_date'            => $issueDate,
            'completion_date'       => $issueDate,
            'expiry_date'           => null,
            'status'                => 'valid',
            'verification_token'    => $token,
            'verification_url'      => $vurl,
            'template_id'           => 'vyomantra_premium_v1',
            'issued_by'             => 'VYOMANTRA TECHNOLOGIES',
            'private_notes'         => 'Bulk generated via CSV on ' . date('Y-m-d'),
            'created_at'            => date('Y-m-d H:i:s'),
            'updated_at'            => date('Y-m-d H:i:s')
        ];

        if ($pdo) {
            try {
                $stmt = $pdo->prepare("
                    INSERT INTO certificates (
                        certificate_id, certificate_type, prefix, recipient_name, recipient_email,
                        course_name, course_duration, description, trainer_name, trainer_designation,
                        signatory_name, signatory_designation, issue_date, completion_date,
                        status, verification_token, verification_url, template_id, issued_by, private_notes,
                        created_at, updated_at
                    ) VALUES (
                        :cid, :ctype, :prefix, :rname, :remail,
                        :cname, :cdur, :desc, :tname, :tdesig,
                        :sname, :sdesig, :idate, :cdate,
                        'valid', :token, :vurl, :tempid, :issuedby, :pnotes,
                        NOW(), NOW()
                    )
                ");
                $stmt->execute([
                    ':cid'      => $certId,
                    ':ctype'    => $item['certificate_type'],
                    ':prefix'   => $prefix,
                    ':rname'    => $item['recipient_name'],
                    ':remail'   => $item['recipient_email'],
                    ':cname'    => $item['course_name'],
                    ':cdur'     => $item['course_duration'],
                    ':desc'     => $item['description'],
                    ':tname'    => $item['trainer_name'],
                    ':tdesig'   => $item['trainer_designation'],
                    ':sname'    => $item['signatory_name'],
                    ':sdesig'   => $item['signatory_designation'],
                    ':idate'    => $item['issue_date'],
                    ':cdate'    => $item['completion_date'],
                    ':token'    => $token,
                    ':vurl'     => $vurl,
                    ':tempid'   => 'vyomantra_premium_v1',
                    ':issuedby' => 'VYOMANTRA TECHNOLOGIES',
                    ':pnotes'   => $item['private_notes']
                ]);
                $item['id'] = (int)$pdo->lastInsertId();
            } catch (\PDOException $e) {
                error_log("Bulk certificate insert DB error: " . $e->getMessage());
            }
        }

        $createdList[] = $item;
        array_unshift($allLocal, $item);
    }

    saveLocalCerts($allLocal);

    sendResponse(true, "Bulk generation completed. Successfully issued " . count($createdList) . " certificates.", [
        'count'        => count($createdList),
        'certificates' => $createdList
    ]);
}

// =========================================================================
// 9. CERTIFICATES STATS
// =========================================================================
if ($action === 'stats') {
    $stats = [
        'total'         => 0,
        'valid'         => 0,
        'revoked'       => 0,
        'expired'       => 0,
        'draft'         => 0,
        'this_month'    => 0,
        'this_year'     => 0,
        'verifications' => 0
    ];

    if ($pdo) {
        try {
            $stmt = $pdo->query("SELECT status, COUNT(*) as cnt FROM certificates GROUP BY status");
            while ($r = $stmt->fetch(PDO::FETCH_ASSOC)) {
                $st = strtolower($r['status']);
                if (isset($stats[$st])) $stats[$st] = (int)$r['cnt'];
                $stats['total'] += (int)$r['cnt'];
            }

            $currentMonth = date('Y-m');
            $currentYear  = date('Y');
            $stmt = $pdo->query("SELECT COUNT(*) FROM certificates WHERE issue_date LIKE '$currentMonth%'");
            $stats['this_month'] = (int)$stmt->fetchColumn();

            $stmt = $pdo->query("SELECT COUNT(*) FROM certificates WHERE issue_date LIKE '$currentYear%'");
            $stats['this_year'] = (int)$stmt->fetchColumn();

            $stmt = $pdo->query("SELECT COUNT(*) FROM certificate_logs");
            $stats['verifications'] = (int)$stmt->fetchColumn();

        } catch (\PDOException $e) {
            error_log("Certificates stats DB error: " . $e->getMessage());
        }
    }

    if ($stats['total'] === 0) {
        $certs = getLocalCerts();
        $stats['total'] = count($certs);
        $currentMonth = date('Y-m');
        $currentYear  = date('Y');
        foreach ($certs as $c) {
            $st = strtolower($c['status'] ?? 'valid');
            if (isset($stats[$st])) $stats[$st]++;
            $idate = $c['issue_date'] ?? '';
            if (strpos($idate, $currentMonth) === 0) $stats['this_month']++;
            if (strpos($idate, $currentYear) === 0)  $stats['this_year']++;
        }

        $logFile = __DIR__ . '/../../data/certificate_logs.json';
        if (file_exists($logFile)) {
            $logs = json_decode(file_get_contents($logFile), true) ?: [];
            $stats['verifications'] = count($logs);
        }
    }

    sendResponse(true, 'Certificate stats compiled', $stats);
}

// =========================================================================
// 10. EXPORT CSV
// =========================================================================
if ($action === 'export_csv') {
    $rows = [];
    if ($pdo) {
        $stmt = $pdo->query("SELECT certificate_id, recipient_name, recipient_email, certificate_type, course_name, course_duration, issue_date, status, verification_url FROM certificates ORDER BY id DESC");
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
    }
    if (empty($rows)) {
        $all = getLocalCerts();
        foreach ($all as $c) {
            $rows[] = [
                'certificate_id'   => $c['certificate_id'] ?? '',
                'recipient_name'   => $c['recipient_name'] ?? '',
                'recipient_email'  => $c['recipient_email'] ?? '',
                'certificate_type' => $c['certificate_type'] ?? '',
                'course_name'      => $c['course_name'] ?? '',
                'course_duration'  => $c['course_duration'] ?? '',
                'issue_date'       => $c['issue_date'] ?? '',
                'status'           => $c['status'] ?? '',
                'verification_url' => $c['verification_url'] ?? ''
            ];
        }
    }

    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename=vyomantra_certificates_' . date('Ymd_His') . '.csv');
    $out = fopen('php://output', 'w');
    fputcsv($out, ['Certificate ID', 'Recipient Name', 'Recipient Email', 'Type', 'Course/Program', 'Duration', 'Issue Date', 'Status', 'Verification URL']);
    foreach ($rows as $r) {
        fputcsv($out, $r);
    }
    fclose($out);
    exit;
}

sendResponse(false, 'Invalid certificate action specified.', [], 400);
