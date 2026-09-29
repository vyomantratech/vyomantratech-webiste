<?php
/**
 * Vyomantra Technologies - Project Quote & Blueprint Request API Endpoint
 * Handles submissions from request-a-quote.html
 * Stores data into Hostinger MySQL table: `quote_requests`
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

$name         = trim($input['name'] ?? '');
$company      = trim($input['company'] ?? 'Individual / Startup');
$email        = trim($input['email'] ?? '');
$phone        = trim($input['phone'] ?? '');
$service      = trim($input['service'] ?? 'Custom Software');
$project_type = trim($input['project_type'] ?? ($input['type'] ?? 'New Product Build'));
$budget       = trim($input['budget'] ?? 'Unspecified');
$timeline     = trim($input['timeline'] ?? 'Flexible');
$description  = trim($input['description'] ?? ($input['desc'] ?? ''));
$notes        = trim($input['notes'] ?? '');

// Validation
if (empty($name) || empty($email) || empty($phone) || empty($description)) {
    sendResponse(false, 'Please fill in all required fields (Name, Email, Phone, and Project Description).', [], 400);
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    sendResponse(false, 'Please provide a valid email address.', [], 400);
}

$ip = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';

$pdo = getDbConnection();
$quoteRef = 'VYO-Q' . date('ymd') . '-' . strtoupper(substr(md5(uniqid()), 0, 4));

if ($pdo) {
    try {
        $stmt = $pdo->prepare("
            INSERT INTO `quote_requests`
            (`name`, `company`, `email`, `phone`, `service`, `project_type`, `budget`, `timeline`, `description`, `notes`, `ip_address`, `status`, `created_at`)
            VALUES
            (:name, :company, :email, :phone, :service, :project_type, :budget, :timeline, :description, :notes, :ip, 'new', NOW())
        ");
        $stmt->execute([
            ':name'         => $name,
            ':company'      => $company,
            ':email'        => $email,
            ':phone'        => $phone,
            ':service'      => $service,
            ':project_type' => $project_type,
            ':budget'       => $budget,
            ':timeline'     => $timeline,
            ':description'  => $description,
            ':notes'        => $notes,
            ':ip'           => $ip
        ]);
        $insertId = $pdo->lastInsertId();
        $quoteRef = 'VYO-Q' . str_pad($insertId, 5, '0', STR_PAD_LEFT);
    } catch (\PDOException $e) {
        error_log("Quote Request DB Insert Error: " . $e->getMessage());
        // Still proceed with generated reference
    }
} else {
    // Log to file if database credentials are not yet configured on Hostinger
    $logDir = __DIR__ . '/../logs';
    if (!is_dir($logDir)) {
        @mkdir($logDir, 0755, true);
    }
    $logEntry = date('Y-m-d H:i:s') . " | Ref: $quoteRef | Name: $name | Company: $company | Email: $email | Phone: $phone | Service: $service | Type: $project_type | Budget: $budget | Timeline: $timeline | Desc: " . str_replace("\n", " ", $description) . " | Notes: " . str_replace("\n", " ", $notes) . "\n";
    @file_put_contents($logDir . '/quote_requests.log', $logEntry, FILE_APPEND);
}

sendResponse(true, 'Our team will review your specifications and share your customized blueprint and project details within 4 hours.', [
    'quote_ref'    => $quoteRef,
    'name'         => $name,
    'email'        => $email,
    'service'      => $service,
    'project_type' => $project_type,
    'turnaround'   => '4 hours'
]);
