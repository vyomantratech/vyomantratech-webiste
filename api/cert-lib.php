<?php
/**
 * Vyomantra Technologies - Shared certificate helpers (public verify + download).
 * Keeps the same storage logic as before: MySQL first, data/certificates.json fallback.
 */

/** Strict ID/token format. Anything else is treated as "not found". */
function certIsValidQuery($q) {
    return is_string($q) && preg_match('/^[A-Za-z0-9_-]{6,80}$/', $q) === 1;
}

/** Client IP (first X-Forwarded-For hop, as before). */
function certClientIp() {
    $ip = $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1';
    if (!empty($_SERVER['HTTP_X_FORWARDED_FOR'])) {
        $parts = explode(',', $_SERVER['HTTP_X_FORWARDED_FOR']);
        $ip = trim($parts[0]);
    }
    return $ip;
}

/** One-way hash so audit logs never store a raw IP address. */
function certHashIp($ip) {
    return substr(hash('sha256', $ip . '|vyomantra-cert-log'), 0, 16);
}

/**
 * Simple file-based rate limiter (works on shared hosting, no DB needed).
 * Default: 30 requests per minute per IP per bucket. Sends 429 and exits when exceeded.
 */
function certRateLimit($bucket, $limit = 30, $window = 60) {
    $dir = __DIR__ . '/../logs/ratelimit';
    if (!is_dir($dir)) { @mkdir($dir, 0755, true); }
    $file = $dir . '/' . preg_replace('/[^a-z0-9_]/i', '_', $bucket) . '_' . certHashIp(certClientIp()) . '.json';
    $now = time();
    $hits = [];
    if (is_file($file)) {
        $hits = json_decode((string)@file_get_contents($file), true) ?: [];
        $hits = array_values(array_filter($hits, function ($t) use ($now, $window) { return ($now - (int)$t) < $window; }));
    }
    if (count($hits) >= $limit) {
        header('Retry-After: ' . $window);
        sendResponse(false, 'Too many requests. Please wait a minute and try again.', ['status' => 'rate_limited'], 429);
    }
    $hits[] = $now;
    @file_put_contents($file, json_encode($hits), LOCK_EX);
}

/** Find a certificate by Certificate ID or verification token (DB first, JSON fallback). */
function certFind($pdo, $query) {
    $found = null;
    if ($pdo) {
        try {
            $stmt = $pdo->prepare('SELECT * FROM certificates WHERE (certificate_id = :id OR verification_token = :token) LIMIT 1');
            $stmt->execute([':id' => $query, ':token' => $query]);
            $found = $stmt->fetch(PDO::FETCH_ASSOC) ?: null;
        } catch (\PDOException $e) {
            error_log('Certificate lookup error: ' . $e->getMessage());
        }
    }
    if (!$found) {
        $jsonFile = __DIR__ . '/../data/certificates.json';
        if (file_exists($jsonFile)) {
            $certs = json_decode(file_get_contents($jsonFile), true) ?: [];
            $upper = strtoupper($query);
            foreach ($certs as $c) {
                if (strtoupper($c['certificate_id'] ?? '') === $upper || ($c['verification_token'] ?? '') === $query) {
                    $found = $c;
                    break;
                }
            }
        }
    }
    return $found;
}

/** valid | revoked | expired (draft is handled by callers as "not found"). */
function certEffectiveStatus($cert) {
    $status = strtolower($cert['status'] ?? 'valid');
    if ($status === 'valid' && !empty($cert['expiry_date']) && strtotime($cert['expiry_date']) < time()) {
        $status = 'expired';
    }
    return $status;
}

/** Absolute path of the stored certificate PDF, or null. Never exposed publicly. */
function certPdfPath($cert) {
    $stored = $cert['certificate_pdf_url'] ?? '';
    if (!$stored) return null;
    $name = basename((string)parse_url($stored, PHP_URL_PATH));
    $name = rawurldecode($name);
    if (!preg_match('/^[A-Za-z0-9_.-]+\.pdf$/', $name)) return null;
    $path = realpath(__DIR__ . '/../uploads/certificates/' . $name);
    $base = realpath(__DIR__ . '/../uploads/certificates');
    if (!$path || !$base || strpos($path, $base . DIRECTORY_SEPARATOR) !== 0 || !is_file($path)) return null;
    return $path;
}

/** Audit log. Stores a hashed IP and no user-agent (no personal data). */
function certRecordAudit($pdo, $certId, $method, $result) {
    $ipHash = certHashIp(certClientIp());
    if ($pdo) {
        try {
            $stmt = $pdo->prepare('INSERT INTO certificate_logs (certificate_id, verification_timestamp, verification_method, ip_address, user_agent, result)
                                   VALUES (:cid, NOW(), :method, :ip, :ua, :res)');
            $stmt->execute([':cid' => $certId, ':method' => $method, ':ip' => $ipHash, ':ua' => '', ':res' => $result]);
            return;
        } catch (\PDOException $e) {
            error_log('certificate_logs insert failed: ' . $e->getMessage());
        }
    }
    $logFile = __DIR__ . '/../data/certificate_logs.json';
    $logs = file_exists($logFile) ? (json_decode(file_get_contents($logFile), true) ?: []) : [];
    $logs[] = [
        'id' => count($logs) + 1, 'certificate_id' => $certId,
        'verification_timestamp' => date('Y-m-d H:i:s'), 'verification_method' => $method,
        'ip_address' => $ipHash, 'user_agent' => '', 'result' => $result
    ];
    if (count($logs) > 500) { $logs = array_slice($logs, -500); }
    @file_put_contents($logFile, json_encode($logs, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES), LOCK_EX);
}
