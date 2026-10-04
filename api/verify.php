<?php
header('X-Robots-Tag: noindex, nofollow', true);
/**
 * Vyomantra Technologies - Public Certificate Verification API
 * Public endpoint (no auth). Returns ONLY an allow-listed set of fields.
 * Never returns: email, phone, notes, token, file path, revoke reason, database id.
 */

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/cert-lib.php';

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-Requested-With');
header('Cache-Control: no-store');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

certRateLimit('verify', 30, 60);

$certQuery = trim((string)($_GET['id'] ?? $_POST['id'] ?? ''));
$method = trim((string)($_GET['method'] ?? $_POST['method'] ?? 'QR_SCAN'));
if (!in_array($method, ['QR_SCAN', 'MANUAL_ID'], true)) { $method = 'QR_SCAN'; }

if ($certQuery === '') {
    sendResponse(false, 'Certificate ID is required.', ['status' => 'empty'], 400);
}

$pdo = getDbConnection();

// Same response for malformed IDs and unknown IDs (nothing to probe).
$notFound = function () use ($pdo, $method) {
    certRecordAudit($pdo, 'unknown', $method, 'not_found');
    sendResponse(false, 'No certificate found with this ID. It may be invalid.', ['status' => 'not_found'], 404);
};

if (!certIsValidQuery($certQuery)) { $notFound(); }

$cert = certFind($pdo, $certQuery);
if (!$cert || strtolower($cert['status'] ?? '') === 'draft') { $notFound(); }

$status = certEffectiveStatus($cert);
certRecordAudit($pdo, $cert['certificate_id'], $method, $status);

// Revoked: confirm status only. No personal or program details.
if ($status === 'revoked') {
    sendResponse(true, 'This certificate has been revoked by VYOMANTRA TECHNOLOGIES.', [
        'certificate_id' => $cert['certificate_id'],
        'status'         => 'revoked',
        'issued_by'      => 'VYOMANTRA TECHNOLOGIES',
        'pdf_available'  => false,
        'verified_at'    => date('c')
    ], 200);
}

$uploadInfo  = ($status === 'valid') ? certGetUploadInfo($cert) : null;
$pdfAvailable = ($uploadInfo !== null);
$fileType     = $uploadInfo ? $uploadInfo['ext'] : null; // 'pdf' or 'docx'

// Explicit allow-list (do not "return the row minus some fields").
$public = [
    'certificate_id'   => $cert['certificate_id'],
    'status'           => $status,
    'recipient_name'   => $cert['recipient_name'],
    'program_name'     => $cert['course_name'],
    'program_type'     => $cert['program_type'] ?? '',
    'certificate_type' => $cert['certificate_type'] ?? '',
    'recognition'      => $cert['recognition'] ?? '',
    'duration'         => $cert['course_duration'] ?? '',
    'issue_date'       => $cert['issue_date'],
    'issued_by'        => 'VYOMANTRA TECHNOLOGIES',
    'pdf_available'    => $pdfAvailable,
    'file_type'        => $fileType,
    'download_url'     => $pdfAvailable ? (SITE_URL . '/api/download.php?id=' . rawurlencode($cert['certificate_id'])) : null,
    'verified_at'      => date('c')
];

if ($status === 'valid') {
    sendResponse(true, 'Certificate Verified. This credential was issued by VYOMANTRA TECHNOLOGIES and is authentic.', $public, 200);
}
sendResponse(true, 'Certificate Expired. The validity period for this credential has elapsed.', $public, 200);
