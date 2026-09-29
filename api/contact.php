<?php
/**
 * Vyomantra Technologies - Contact Form API Endpoint
 */

require_once __DIR__ . '/config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendResponse(false, 'Invalid request method. Only POST allowed.', [], 405);
}

// Support both JSON payload and multipart/urlencoded FormData
$input = json_decode(file_get_contents('php://input'), true);
if (!$input || empty($input)) {
    $input = $_POST;
}

$name    = trim($input['name'] ?? '');
$email   = trim($input['email'] ?? '');
$phone   = trim($input['phone'] ?? '');
$service = trim($input['service'] ?? 'General Inquiry');
$message = trim($input['message'] ?? ($input['msg'] ?? ''));

// Basic validation
if (empty($name) || empty($email) || empty($message)) {
    sendResponse(false, 'Please fill in all required fields (Name, Email, Message).', [], 400);
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    sendResponse(false, 'Please enter a valid email address.', [], 400);
}

$ip = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';

$pdo = getDbConnection();
if ($pdo) {
    try {
        $stmt = $pdo->prepare("
            INSERT INTO `contact_messages` (`name`, `email`, `phone`, `service`, `message`, `ip_address`, `status`, `created_at`)
            VALUES (:name, :email, :phone, :service, :message, :ip, 'new', NOW())
        ");
        $stmt->execute([
            ':name'    => $name,
            ':email'   => $email,
            ':phone'   => $phone,
            ':service' => $service,
            ':message' => $message,
            ':ip'      => $ip
        ]);
        $insertId = $pdo->lastInsertId();
    } catch (\PDOException $e) {
        error_log("Contact DB Insert Error: " . $e->getMessage());
        // Fallback response so user is never blocked
        $insertId = 'pending_sync';
    }
} else {
    // Database credentials not yet configured on Hostinger
    // Optionally log to a secure local file for backup
    $logDir = __DIR__ . '/../logs';
    if (!is_dir($logDir)) {
        @mkdir($logDir, 0755, true);
    }
    $logEntry = date('Y-m-d H:i:s') . " | Name: $name | Email: $email | Phone: $phone | Service: $service | Msg: " . str_replace("\n", " ", $message) . "\n";
    @file_put_contents($logDir . '/contact_submissions.log', $logEntry, FILE_APPEND);
    $insertId = 'logged';
}

sendResponse(true, 'Thank you! Our team will contact you within 24 hours.', [
    'reference_id' => $insertId
]);
