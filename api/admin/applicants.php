<?php
header('X-Robots-Tag: noindex, nofollow', true);
/**
 * Vyomantra Technologies - Admin Job Applicants Endpoint
 */

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/auth.php';

$adminUser = checkAdminAuth();
$pdo = getDbConnection();

$action = trim($_POST['action'] ?? $_GET['action'] ?? 'list');

// 1. LIST APPLICANTS
if ($action === 'list') {
    $status = trim($_GET['status'] ?? 'all');
    $role   = trim($_GET['role'] ?? 'all');
    $search = trim($_GET['search'] ?? '');
    $limit  = max(1, min(100, (int)($_GET['limit'] ?? 50)));
    $offset = max(0, (int)($_GET['offset'] ?? 0));

    $applicants = [];
    $total = 0;

    if ($pdo) {
        try {
            $where = "WHERE 1=1";
            $params = [];

            if ($status !== 'all') {
                $where .= " AND status = :st";
                $params[':st'] = $status;
            }
            if ($role !== 'all') {
                $where .= " AND role_applied LIKE :r";
                $params[':r'] = "%$role%";
            }
            if (!empty($search)) {
                $where .= " AND (name LIKE :s OR email LIKE :s OR phone LIKE :s OR role_applied LIKE :s OR message LIKE :s)";
                $params[':s'] = "%$search%";
            }

            $cntStmt = $pdo->prepare("SELECT COUNT(*) FROM job_applications $where");
            $cntStmt->execute($params);
            $total = (int)$cntStmt->fetchColumn();

            $stmt = $pdo->prepare("SELECT * FROM job_applications $where ORDER BY created_at DESC LIMIT $limit OFFSET $offset");
            $stmt->execute($params);
            $applicants = $stmt->fetchAll(PDO::FETCH_ASSOC);
        } catch (\PDOException $e) {
            error_log("Applicants list error: " . $e->getMessage());
        }
    }

    sendResponse(true, 'Applicants retrieved', [
        'total'      => $total,
        'applicants' => $applicants
    ]);
}

// 2. UPDATE STATUS
if ($action === 'update_status') {
    $id = (int)($_POST['id'] ?? 0);
    $status = trim($_POST['status'] ?? '');
    $allowed = ['applied', 'reviewing', 'interview_scheduled', 'offered', 'rejected'];

    if (!$id || !in_array($status, $allowed)) {
        sendResponse(false, 'Invalid ID or status value.', [], 400);
    }

    if ($pdo) {
        $stmt = $pdo->prepare("UPDATE job_applications SET status = :st WHERE id = :id");
        $stmt->execute([':st' => $status, ':id' => $id]);
    }
    sendResponse(true, "Application #$id status updated to $status.");
}

// 3. DELETE APPLICANT
if ($action === 'delete') {
    $id = (int)($_POST['id'] ?? 0);
    if (!$id) {
        sendResponse(false, 'Valid applicant ID is required.', [], 400);
    }

    if ($pdo) {
        $stmt = $pdo->prepare("DELETE FROM job_applications WHERE id = :id");
        $stmt->execute([':id' => $id]);
    }
    sendResponse(true, "Application #$id removed successfully.");
}

// 4. EXPORT CSV
if ($action === 'export_csv') {
    if ($pdo) {
        $stmt = $pdo->query("SELECT id, name, email, phone, role_applied, experience, portfolio_url, resume_filename, resume_filepath, message, status, created_at FROM job_applications ORDER BY id DESC");
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        header('Content-Type: text/csv; charset=utf-8');
        header('Content-Disposition: attachment; filename=vyomantra_applicants_' . date('Ymd_His') . '.csv');
        $out = fopen('php://output', 'w');
        fputcsv($out, ['ID', 'Candidate Name', 'Email', 'Phone', 'Role Applied', 'Experience', 'Portfolio URL', 'Resume Filename', 'Resume Filepath', 'Cover Note', 'Status', 'Applied Date']);
        foreach ($rows as $r) {
            fputcsv($out, $r);
        }
        fclose($out);
        exit;
    }
}

sendResponse(false, 'Invalid applicants action', [], 400);
