<?php
header('X-Robots-Tag: noindex, nofollow', true);
/**
 * Vyomantra Technologies - Public Certificate Verification API
 * Public Endpoint: Returns authenticity status and non-sensitive certificate details.
 * Accessible without authentication. Automatically records verification audit logs.
 */

require_once __DIR__ . '/config.php';

// Rate-limiting safeguard or header setup
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-Requested-With');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Extract query parameters
$certQuery = trim($_GET['id'] ?? $_POST['id'] ?? '');
$method = trim($_GET['method'] ?? $_POST['method'] ?? 'QR_SCAN');
if (!in_array($method, ['QR_SCAN', 'MANUAL_ID'])) {
    $method = 'QR_SCAN';
}

if (empty($certQuery)) {
    sendResponse(false, 'Certificate ID or verification token is required.', [
        'status' => 'empty'
    ], 400);
}

// Client metadata for audit log
$ip = $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1';
if (!empty($_SERVER['HTTP_X_FORWARDED_FOR'])) {
    $ipList = explode(',', $_SERVER['HTTP_X_FORWARDED_FOR']);
    $ip = trim($ipList[0]);
}
$userAgent = substr($_SERVER['HTTP_USER_AGENT'] ?? 'Unknown Agent', 0, 250);

$pdo = getDbConnection();
$foundCert = null;

if ($pdo) {
    try {
        $stmt = $pdo->prepare("
            SELECT * FROM certificates 
            WHERE (certificate_id = :id OR verification_token = :token) 
            LIMIT 1
        ");
        $stmt->execute([
            ':id'    => $certQuery,
            ':token' => $certQuery
        ]);
        $foundCert = $stmt->fetch(PDO::FETCH_ASSOC);
    } catch (\PDOException $e) {
        error_log("Verify DB query error: " . $e->getMessage());
    }
}

// Fallback to data/certificates.json if DB not connected or record not found in DB
if (!$foundCert) {
    $jsonFile = __DIR__ . '/../data/certificates.json';
    if (file_exists($jsonFile)) {
        $certs = json_decode(file_get_contents($jsonFile), true) ?: [];
        $upperQuery = strtoupper($certQuery);
        foreach ($certs as $c) {
            if (strtoupper($c['certificate_id'] ?? '') === $upperQuery || ($c['verification_token'] ?? '') === $certQuery) {
                $foundCert = $c;
                break;
            }
        }
    }
}

// Log audit helper
function recordVerificationAudit($pdo, $certId, $method, $ip, $userAgent, $result) {
    if ($pdo) {
        try {
            $logStmt = $pdo->prepare("
                INSERT INTO certificate_logs (certificate_id, verification_timestamp, verification_method, ip_address, user_agent, result)
                VALUES (:cid, NOW(), :method, :ip, :ua, :res)
            ");
            $logStmt->execute([
                ':cid'    => $certId,
                ':method' => $method,
                ':ip'     => $ip,
                ':ua'     => $userAgent,
                ':res'    => $result
            ]);
            return;
        } catch (\PDOException $e) {
            error_log("Failed to insert into certificate_logs: " . $e->getMessage());
        }
    }

    // JSON fallback for logs
    $logFile = __DIR__ . '/../data/certificate_logs.json';
    $logs = file_exists($logFile) ? (json_decode(file_get_contents($logFile), true) ?: []) : [];
    $logs[] = [
        'id'                     => count($logs) + 1,
        'certificate_id'         => $certId,
        'verification_timestamp' => date('Y-m-d H:i:s'),
        'verification_method'    => $method,
        'ip_address'             => $ip,
        'user_agent'             => $userAgent,
        'result'                 => $result
    ];
    // Keep max 500 logs in JSON
    if (count($logs) > 500) {
        $logs = array_slice($logs, -500);
    }
    @file_put_contents($logFile, json_encode($logs, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));
}

// Helper to get verification count
function getVerificationCount($pdo, $certId) {
    if ($pdo) {
        try {
            $cntStmt = $pdo->prepare("SELECT COUNT(*) FROM certificate_logs WHERE certificate_id = :cid");
            $cntStmt->execute([':cid' => $certId]);
            return (int)$cntStmt->fetchColumn();
        } catch (\PDOException $e) {
            // fallback
        }
    }
    $logFile = __DIR__ . '/../data/certificate_logs.json';
    if (file_exists($logFile)) {
        $logs = json_decode(file_get_contents($logFile), true) ?: [];
        $cnt = 0;
        foreach ($logs as $l) {
            if (($l['certificate_id'] ?? '') === $certId) {
                $cnt++;
            }
        }
        return $cnt;
    }
    return 1;
}

// 1. Certificate Not Found
if (!$foundCert) {
    recordVerificationAudit($pdo, $certQuery, $method, $ip, $userAgent, 'not_found');
    sendResponse(false, 'Certificate Not Found. We could not find an official credential matching this Certificate ID.', [
        'status'         => 'not_found',
        'certificate_id' => htmlspecialchars($certQuery, ENT_QUOTES, 'UTF-8')
    ], 404);
}

// 2. Draft Certificate (Never exposed publicly)
if (($foundCert['status'] ?? '') === 'draft') {
    sendResponse(false, 'Certificate Not Found or Not Yet Issued.', [
        'status'         => 'not_found',
        'certificate_id' => htmlspecialchars($certQuery, ENT_QUOTES, 'UTF-8')
    ], 404);
}

// Check for expiry date
$status = strtolower($foundCert['status'] ?? 'valid');
if (!empty($foundCert['expiry_date']) && strtotime($foundCert['expiry_date']) < time()) {
    $status = 'expired';
}

// Record successful lookup audit
recordVerificationAudit($pdo, $foundCert['certificate_id'], $method, $ip, $userAgent, $status);
$verificationCount = getVerificationCount($pdo, $foundCert['certificate_id']);

// Format clean, safe public response
$publicCertificate = [
    'certificate_id'        => $foundCert['certificate_id'],
    'recipient_name'        => $foundCert['recipient_name'],
    'certificate_type'      => $foundCert['certificate_type'] ?? 'Course Completion',
    'course_name'           => $foundCert['course_name'],
    'course_duration'       => $foundCert['course_duration'] ?? '3 Months',
    'description'           => $foundCert['description'] ?? '',
    'trainer_name'          => $foundCert['trainer_name'] ?? 'Santhosh S',
    'trainer_designation'   => $foundCert['trainer_designation'] ?? 'Lead Technical Instructor',
    'signatory_name'        => $foundCert['signatory_name'] ?? 'S.B. Sachin',
    'signatory_designation' => $foundCert['signatory_designation'] ?? 'Founder & CEO',
    'issue_date'            => $foundCert['issue_date'],
    'completion_date'       => $foundCert['completion_date'] ?? $foundCert['issue_date'],
    'expiry_date'           => $foundCert['expiry_date'] ?? null,
    'status'                => $status,
    'issued_by'             => $foundCert['issued_by'] ?? 'VYOMANTRA TECHNOLOGIES',
    'verification_url'      => SITE_URL . '/verify/?id=' . urlencode($foundCert['certificate_id']),
    'certificate_pdf_url'   => $foundCert['certificate_pdf_url'] ?? null,
    'template_id'           => $foundCert['template_id'] ?? 'vyomantra_premium_v1',
    'revoked_at'            => ($status === 'revoked') ? ($foundCert['revoked_at'] ?? null) : null,
    'revocation_reason'     => ($status === 'revoked') ? ($foundCert['revocation_reason'] ?? 'Revoked by Issuing Authority') : null,
    'verification_count'    => $verificationCount,
    'verified_at'           => date('c')
];

if ($status === 'valid') {
    sendResponse(true, 'Certificate Verified. This credential was issued by VYOMANTRA TECHNOLOGIES and is authentic.', $publicCertificate, 200);
} elseif ($status === 'revoked') {
    sendResponse(true, 'Certificate Revoked. This credential was previously issued by VYOMANTRA TECHNOLOGIES but has been revoked.', $publicCertificate, 200);
} elseif ($status === 'expired') {
    sendResponse(true, 'Certificate Expired. The validity period for this credential has elapsed.', $publicCertificate, 200);
} else {
    sendResponse(true, 'Certificate Record Found.', $publicCertificate, 200);
}
