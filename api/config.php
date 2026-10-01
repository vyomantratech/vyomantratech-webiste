<?php
header('X-Robots-Tag: noindex, nofollow', true);
/**
 * Vyomantra Technologies - Database & API Configuration
 * Compatible with Hostinger Cloud / Shared Web Hosting MySQL
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// -------------------------------------------------------------
// Hostinger Database Credentials
// Update these once your domain and Hostinger MySQL database are created:
// -------------------------------------------------------------
define('DB_HOST', 'localhost');
define('DB_NAME', 'vyomantra_db');      // e.g. u123456789_vyomantra
define('DB_USER', 'vyomantra_user');    // e.g. u123456789_admin
define('DB_PASS', 'your_db_password');  // Your database password
define('DB_CHARSET', 'utf8mb4');

// -------------------------------------------------------------
// Site URL Configuration (for QR Codes, Verification URLs, etc.)
// -------------------------------------------------------------
if (!defined('SITE_URL')) {
    $envSiteUrl = getenv('SITE_URL') ?: getenv('NEXT_PUBLIC_SITE_URL');
    if ($envSiteUrl) {
        define('SITE_URL', rtrim($envSiteUrl, '/'));
    } else {
        $isHttps = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || (isset($_SERVER['SERVER_PORT']) && $_SERVER['SERVER_PORT'] == 443) || (isset($_SERVER['HTTP_X_FORWARDED_PROTO']) && $_SERVER['HTTP_X_FORWARDED_PROTO'] === 'https');
        $protocol = $isHttps ? "https://" : "http://";
        $host = $_SERVER['HTTP_HOST'] ?? 'localhost';
        define('SITE_URL', $protocol . $host);
    }
}


/**
 * Returns a PDO connection or null if credentials are not configured yet
 */
function getDbConnection() {
    static $pdo = null;
    if ($pdo !== null) {
        return $pdo;
    }

    // Check if placeholder is still set
    if (DB_PASS === 'your_db_password' || DB_NAME === 'vyomantra_db') {
        // Not configured yet; return null to allow simulation/graceful logging
        return null;
    }

    try {
        $dsn = "mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=" . DB_CHARSET;
        $options = [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
        ];
        $pdo = new PDO($dsn, DB_USER, DB_PASS, $options);
        return $pdo;
    } catch (\PDOException $e) {
        error_log("Database connection error: " . $e->getMessage());
        return null;
    }
}

/**
 * Helper to send clean JSON response
 */
function sendResponse($success, $message, $data = [], $statusCode = 200) {
    http_response_code($statusCode);
    echo json_encode([
        'success'   => $success,
        'message'   => $message,
        'data'      => $data,
        'timestamp' => date('c')
    ], JSON_UNESCAPED_UNICODE);
    exit;
}
