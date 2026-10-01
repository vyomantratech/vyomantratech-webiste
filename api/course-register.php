<?php
header('X-Robots-Tag: noindex, nofollow', true);
/**
 * Vyomantra Technologies - Course Registration & Payment Verification API Endpoint
 */

require_once __DIR__ . '/config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendResponse(false, 'Invalid request method. Only POST allowed.', [], 405);
}

$student_name     = trim($_POST['student_name'] ?? ($_POST['name'] ?? ''));
$email            = trim($_POST['email'] ?? '');
$phone            = trim($_POST['phone'] ?? '');
$course_name      = trim($_POST['course_name'] ?? ($_POST['course'] ?? 'Python with AI Tools'));
$course_mode      = trim($_POST['course_mode'] ?? 'Live Online Cohort');
$reference_number = trim($_POST['reference_number'] ?? ($_POST['ref_no'] ?? ''));
$notes            = trim($_POST['notes'] ?? '');
$amount_paid      = 649.00;

if (empty($student_name) || empty($email) || empty($phone) || empty($reference_number)) {
    sendResponse(false, 'Please fill in all required fields including Transaction / Reference Number.', [], 400);
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    sendResponse(false, 'Please enter a valid email address.', [], 400);
}

// Handle Payment Screenshot Upload
$screenshotFilename = null;
$screenshotRelPath  = null;

if (isset($_FILES['screenshot']) && $_FILES['screenshot']['error'] === UPLOAD_ERR_OK) {
    $fileTmpPath   = $_FILES['screenshot']['tmp_name'];
    $originalName  = $_FILES['screenshot']['name'];
    $fileSize      = $_FILES['screenshot']['size'];
    $fileExtension = strtolower(pathinfo($originalName, PATHINFO_EXTENSION));

    $allowedExtensions = ['jpg', 'jpeg', 'png', 'webp', 'pdf'];
    if (!in_array($fileExtension, $allowedExtensions)) {
        sendResponse(false, 'Invalid screenshot format. Please upload JPG, PNG, WEBP, or PDF.', [], 400);
    }

    if ($fileSize > 10 * 1024 * 1024) {
        sendResponse(false, 'Screenshot file exceeds maximum limit of 10MB.', [], 400);
    }

    $uploadDir = __DIR__ . '/../uploads/payments/';
    if (!is_dir($uploadDir)) {
        @mkdir($uploadDir, 0755, true);
    }

    $cleanName = preg_replace('/[^a-zA-Z0-9_-]/', '_', pathinfo($originalName, PATHINFO_FILENAME));
    $newFileName = 'pay_' . time() . '_' . substr($cleanName, 0, 20) . '.' . $fileExtension;
    $destination = $uploadDir . $newFileName;

    if (move_uploaded_file($fileTmpPath, $destination)) {
        $screenshotFilename = $originalName;
        $screenshotRelPath  = 'uploads/payments/' . $newFileName;
    }
}

$ip = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';

$pdo = getDbConnection();
if ($pdo) {
    try {
        $stmt = $pdo->prepare("
            INSERT INTO `course_registrations`
            (`student_name`, `email`, `phone`, `course_name`, `course_mode`, `amount_paid`, `reference_number`, `screenshot_filename`, `screenshot_filepath`, `notes`, `ip_address`, `payment_status`, `created_at`)
            VALUES
            (:sname, :email, :phone, :course, :mode, :amount, :ref, :s_name, :s_path, :notes, :ip, 'pending_verification', NOW())
        ");
        $stmt->execute([
            ':sname'  => $student_name,
            ':email'  => $email,
            ':phone'  => $phone,
            ':course' => $course_name,
            ':mode'   => $course_mode,
            ':amount' => $amount_paid,
            ':ref'    => $reference_number,
            ':s_name' => $screenshotFilename,
            ':s_path' => $screenshotRelPath,
            ':notes'  => $notes,
            ':ip'     => $ip
        ]);
        $regId = $pdo->lastInsertId();
    } catch (\PDOException $e) {
        error_log("Course Register DB Insert Error: " . $e->getMessage());
        $regId = 'VYO-' . strtoupper(substr(md5(uniqid()), 0, 8));
    }
} else {
    // Log to file if DB not yet configured
    $logDir = __DIR__ . '/../logs';
    if (!is_dir($logDir)) {
        @mkdir($logDir, 0755, true);
    }
    $logEntry = date('Y-m-d H:i:s') . " | Student: $student_name | Email: $email | Phone: $phone | Course: $course_name | Ref: $reference_number | Screenshot: $screenshotRelPath\n";
    @file_put_contents($logDir . '/course_registrations.log', $logEntry, FILE_APPEND);
    $regId = 'VYO-' . strtoupper(substr(md5(uniqid()), 0, 8));
}

sendResponse(true, 'Registration submitted successfully! Your payment reference is recorded. Our admissions counselor will verify your transaction and contact you within 24 hours with your cohort onboarding credentials.', [
    'registration_id' => $regId,
    'reference_number' => $reference_number
]);
