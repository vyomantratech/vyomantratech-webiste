<?php
/**
 * Vyomantra Technologies - Admin Course Registrations & Payment Verification Endpoint
 */

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/auth.php';

$adminUser = checkAdminAuth();
$pdo = getDbConnection();

$action = trim($_POST['action'] ?? $_GET['action'] ?? 'list');

// 1. LIST REGISTRATIONS
if ($action === 'list') {
    $status = trim($_GET['status'] ?? 'all');
    $course = trim($_GET['course'] ?? 'all');
    $search = trim($_GET['search'] ?? '');
    $limit  = max(1, min(100, (int)($_GET['limit'] ?? 50)));
    $offset = max(0, (int)($_GET['offset'] ?? 0));

    $registrations = [];
    $total = 0;

    if ($pdo) {
        try {
            $where = "WHERE 1=1";
            $params = [];

            if ($status !== 'all') {
                $where .= " AND payment_status = :st";
                $params[':st'] = $status;
            }
            if ($course !== 'all') {
                $where .= " AND course_name LIKE :c";
                $params[':c'] = "%$course%";
            }
            if (!empty($search)) {
                $where .= " AND (student_name LIKE :s OR email LIKE :s OR phone LIKE :s OR reference_number LIKE :s)";
                $params[':s'] = "%$search%";
            }

            $cntStmt = $pdo->prepare("SELECT COUNT(*) FROM course_registrations $where");
            $cntStmt->execute($params);
            $total = (int)$cntStmt->fetchColumn();

            $stmt = $pdo->prepare("SELECT * FROM course_registrations $where ORDER BY created_at DESC LIMIT $limit OFFSET $offset");
            $stmt->execute($params);
            $registrations = $stmt->fetchAll(PDO::FETCH_ASSOC);
        } catch (\PDOException $e) {
            error_log("Courses list error: " . $e->getMessage());
        }
    }

    sendResponse(true, 'Registrations retrieved', [
        'total'         => $total,
        'registrations' => $registrations
    ]);
}

// 2. VERIFY PAYMENT STATUS
if ($action === 'verify_payment') {
    $id = (int)($_POST['id'] ?? 0);
    $status = trim($_POST['status'] ?? '');
    $allowed = ['pending_verification', 'verified', 'rejected'];

    if (!$id || !in_array($status, $allowed)) {
        sendResponse(false, 'Invalid ID or payment status.', [], 400);
    }

    if ($pdo) {
        $stmt = $pdo->prepare("UPDATE course_registrations SET payment_status = :st WHERE id = :id");
        $stmt->execute([':st' => $status, ':id' => $id]);
    }
    sendResponse(true, "Registration #$id payment status updated to $status.");
}

// 3. DELETE REGISTRATION
if ($action === 'delete') {
    $id = (int)($_POST['id'] ?? 0);
    if (!$id) {
        sendResponse(false, 'Valid registration ID is required.', [], 400);
    }

    if ($pdo) {
        $stmt = $pdo->prepare("DELETE FROM course_registrations WHERE id = :id");
        $stmt->execute([':id' => $id]);
    }
    sendResponse(true, "Registration #$id deleted successfully.");
}

// 4. EXPORT CSV
if ($action === 'export_csv') {
    if ($pdo) {
        $stmt = $pdo->query("SELECT id, student_name, email, phone, course_name, course_mode, amount_paid, reference_number, screenshot_filepath, payment_status, created_at FROM course_registrations ORDER BY id DESC");
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        header('Content-Type: text/csv; charset=utf-8');
        header('Content-Disposition: attachment; filename=vyomantra_course_registrations_' . date('Ymd_His') . '.csv');
        $out = fopen('php://output', 'w');
        fputcsv($out, ['ID', 'Student Name', 'Email', 'Phone', 'Course', 'Mode', 'Amount (INR)', 'UTR/Reference No', 'Payment Proof File', 'Payment Status', 'Registration Date']);
        foreach ($rows as $r) {
            fputcsv($out, $r);
        }
        fclose($out);
        exit;
    }
}

sendResponse(false, 'Invalid course action', [], 400);
