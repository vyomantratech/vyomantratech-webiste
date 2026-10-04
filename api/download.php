<?php
header('X-Robots-Tag: noindex, nofollow', true);
/**
 * Vyomantra Technologies - Public certificate file download.
 * Streams the stored file (PDF or DOCX) ONLY for valid (non-revoked, non-expired) certificates.
 * The storage path is never exposed; uploads/certificates/ is blocked for direct access.
 */

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/cert-lib.php';

certRateLimit('download', 30, 60);

$q   = trim((string)($_GET['id'] ?? ''));
$pdo = getDbConnection();

$unavailable = function () {
    sendResponse(false, 'Not available.', ['status' => 'not_available'], 404);
};

if (!certIsValidQuery($q)) { $unavailable(); }
$cert = certFind($pdo, $q);
if (!$cert || strtolower($cert['status'] ?? '') === 'draft') { $unavailable(); }
if (certEffectiveStatus($cert) !== 'valid') { $unavailable(); }

$info = certGetUploadInfo($cert);
if ($info === null) { $unavailable(); }

$safeName = preg_replace('/[^A-Za-z0-9]+/', '_', (string)$cert['recipient_name']);
$safeName = trim($safeName, '_') ?: 'Recipient';
$ext      = $info['ext'];  // 'pdf' or 'docx'
$filename = 'Vyomantra_Certificate_' . $safeName . '_' . $cert['certificate_id'] . '.' . $ext;

header_remove('Content-Type');
header('Content-Type: ' . $info['mime']);
header('Content-Disposition: attachment; filename="' . $filename . '"');
header('Content-Length: ' . filesize($info['path']));
header('Cache-Control: private, no-store');
header('X-Content-Type-Options: nosniff');
readfile($info['path']);
exit;
