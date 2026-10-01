<?php
header('X-Robots-Tag: noindex, nofollow', true);
/**
 * Vyomantra Technologies - Admin Quotations Endpoint
 */

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/auth.php';

$adminUser = checkAdminAuth();
$pdo = getDbConnection();

$action = trim($_POST['action'] ?? $_GET['action'] ?? 'list');

// 1. LIST QUOTES
if ($action === 'list') {
    $status = trim($_GET['status'] ?? 'all');
    $search = trim($_GET['search'] ?? '');
    $limit  = max(1, min(100, (int)($_GET['limit'] ?? 50)));
    $offset = max(0, (int)($_GET['offset'] ?? 0));

    $quotes = [];
    $total  = 0;

    if ($pdo) {
        try {
            $where = "WHERE 1=1";
            $params = [];

            if ($status !== 'all') {
                $where .= " AND status = :st";
                $params[':st'] = $status;
            }
            if (!empty($search)) {
                $where .= " AND (name LIKE :s OR email LIKE :s OR company LIKE :s OR service LIKE :s OR phone LIKE :s)";
                $params[':s'] = "%$search%";
            }

            $cntStmt = $pdo->prepare("SELECT COUNT(*) FROM quote_requests $where");
            $cntStmt->execute($params);
            $total = (int)$cntStmt->fetchColumn();

            $stmt = $pdo->prepare("SELECT * FROM quote_requests $where ORDER BY created_at DESC LIMIT $limit OFFSET $offset");
            $stmt->execute($params);
            $quotes = $stmt->fetchAll(PDO::FETCH_ASSOC);
        } catch (\PDOException $e) {
            error_log("Quotes list error: " . $e->getMessage());
        }
    }

    sendResponse(true, 'Quotes retrieved', [
        'total'  => $total,
        'quotes' => $quotes
    ]);
}

// 2. UPDATE STATUS
if ($action === 'update_status') {
    $id = (int)($_POST['id'] ?? 0);
    $status = trim($_POST['status'] ?? '');
    $allowed = ['new', 'contacted', 'proposal_sent', 'closed'];

    if (!$id || !in_array($status, $allowed)) {
        sendResponse(false, 'Invalid ID or status value.', [], 400);
    }

    if ($pdo) {
        $stmt = $pdo->prepare("UPDATE quote_requests SET status = :st WHERE id = :id");
        $stmt->execute([':st' => $status, ':id' => $id]);
    }
    sendResponse(true, "Quote #$id marked as $status");
}

// 3. DELETE QUOTE
if ($action === 'delete') {
    $id = (int)($_POST['id'] ?? 0);
    if (!$id) {
        sendResponse(false, 'Valid quote ID is required.', [], 400);
    }

    if ($pdo) {
        $stmt = $pdo->prepare("DELETE FROM quote_requests WHERE id = :id");
        $stmt->execute([':id' => $id]);
    }
    sendResponse(true, "Quote request #$id deleted successfully.");
}

// 4. EXPORT CSV
if ($action === 'export_csv') {
    if ($pdo) {
        $stmt = $pdo->query("SELECT id, name, company, email, phone, service, project_type, budget, timeline, description, status, created_at FROM quote_requests ORDER BY id DESC");
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        header('Content-Type: text/csv; charset=utf-8');
        header('Content-Disposition: attachment; filename=vyomantra_quotes_' . date('Ymd_His') . '.csv');
        $out = fopen('php://output', 'w');
        fputcsv($out, ['ID', 'Client Name', 'Company', 'Email', 'Phone', 'Service', 'Project Type', 'Budget', 'Timeline', 'Scope Description', 'Status', 'Date']);
        foreach ($rows as $r) {
            fputcsv($out, $r);
        }
        fclose($out);
        exit;
    }
}

sendResponse(false, 'Invalid quotes action', [], 400);
