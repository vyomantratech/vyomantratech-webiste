<?php
header('X-Robots-Tag: noindex, nofollow', true);
/**
 * Vyomantra Technologies - Careers Application API Endpoint
 */

require_once __DIR__ . '/config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendResponse(false, 'Invalid request method. Only POST allowed.', [], 405);
}

$name          = trim($_POST['name'] ?? '');
$email         = trim($_POST['email'] ?? '');
$phone         = trim($_POST['phone'] ?? '');
$role_applied  = trim($_POST['role_applied'] ?? 'General Application');
$experience    = trim($_POST['experience'] ?? 'Fresher / Student');
$portfolio_url = trim($_POST['portfolio_url'] ?? '');
$message       = trim($_POST['message'] ?? '');

if (empty($name) || empty($email) || empty($phone)) {
    sendResponse(false, 'Please provide your Name, Email, and Phone number.', [], 400);
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    sendResponse(false, 'Please enter a valid email address.', [], 400);
}

// Handle Resume File Upload
$resumeFilename = null;
$resumeRelPath  = null;

if (isset($_FILES['resume']) && $_FILES['resume']['error'] === UPLOAD_ERR_OK) {
    $fileTmpPath   = $_FILES['resume']['tmp_name'];
    $originalName  = $_FILES['resume']['name'];
    $fileSize      = $_FILES['resume']['size'];
    $fileExtension = strtolower(pathinfo($originalName, PATHINFO_EXTENSION));

    $allowedExtensions = ['pdf', 'doc', 'docx', 'zip'];
    if (!in_array($fileExtension, $allowedExtensions)) {
        sendResponse(false, 'Invalid file format. Please upload PDF, DOC, or DOCX.', [], 400);
    }

    if ($fileSize > 10 * 1024 * 1024) { // 10 MB limit
        sendResponse(false, 'File size exceeds maximum limit of 10MB.', [], 400);
    }

    $uploadDir = __DIR__ . '/../uploads/resumes/';
    if (!is_dir($uploadDir)) {
        @mkdir($uploadDir, 0755, true);
    }

    $cleanName = preg_replace('/[^a-zA-Z0-9_-]/', '_', pathinfo($originalName, PATHINFO_FILENAME));
    $newFileName = time() . '_' . substr($cleanName, 0, 30) . '.' . $fileExtension;
    $destination = $uploadDir . $newFileName;

    if (move_uploaded_file($fileTmpPath, $destination)) {
        $resumeFilename = $originalName;
        $resumeRelPath  = 'uploads/resumes/' . $newFileName;
    }
}

$ip = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';

$pdo = getDbConnection();
if ($pdo) {
    try {
        $stmt = $pdo->prepare("
            INSERT INTO `job_applications`
            (`name`, `email`, `phone`, `role_applied`, `experience`, `portfolio_url`, `resume_filename`, `resume_filepath`, `message`, `ip_address`, `status`, `created_at`)
            VALUES
            (:name, :email, :phone, :role, :exp, :portfolio, :r_name, :r_path, :message, :ip, 'applied', NOW())
        ");
        $stmt->execute([
            ':name'      => $name,
            ':email'     => $email,
            ':phone'     => $phone,
            ':role'      => $role_applied,
            ':exp'       => $experience,
            ':portfolio' => $portfolio_url,
            ':r_name'    => $resumeFilename,
            ':r_path'    => $resumeRelPath,
            ':message'   => $message,
            ':ip'        => $ip
        ]);
        $appId = $pdo->lastInsertId();
    } catch (\PDOException $e) {
        error_log("Careers DB Insert Error: " . $e->getMessage());
        $appId = 'app_' . time();
    }
} else {
    // Log to file if DB not yet configured on Hostinger
    $logDir = __DIR__ . '/../logs';
    if (!is_dir($logDir)) {
        @mkdir($logDir, 0755, true);
    }
    $logEntry = date('Y-m-d H:i:s') . " | Name: $name | Email: $email | Phone: $phone | Role: $role_applied | Resume: $resumeRelPath\n";
    @file_put_contents($logDir . '/career_applications.log', $logEntry, FILE_APPEND);
    $appId = 'app_' . time();
}

sendResponse(true, 'Application submitted successfully! Our talent acquisition team will review your profile and contact you within 24-48 hours.', [
    'application_id' => $appId
]);
