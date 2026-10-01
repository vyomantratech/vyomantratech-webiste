<?php
header('X-Robots-Tag: noindex, nofollow', true);
/**
 * Vyomantra Technologies - Admin Contacts Inquiries Endpoint
 */

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/auth.php';

$adminUser = checkAdminAuth();
$pdo = getDbConnection();

$action = trim($_POST['action'] ?? $_GET['action'] ?? 'list');

// 1. LIST CONTACTS
if ($action === 'list') {
    $status = trim($_GET['status'] ?? 'all');
    $search = trim($_GET['search'] ?? '');
    $limit  = max(1, min(100, (int)($_GET['limit'] ?? 50)));
    $offset = max(0, (int)($_GET['offset'] ?? 0));

    $contacts = [];
    $total = 0;

    if ($pdo) {
        try {
            $where = "WHERE 1=1";
            $params = [];

            if ($status !== 'all') {
                $where .= " AND status = :st";
                $params[':st'] = $status;
            }
            if (!empty($search)) {
                $where .= " AND (name LIKE :s OR email LIKE :s OR phone LIKE :s OR service LIKE :s OR message LIKE :s)";
                $params[':s'] = "%$search%";
            }

            // Total count
            $cntStmt = $pdo->prepare("SELECT COUNT(*) FROM contact_messages $where");
            $cntStmt->execute($params);
            $total = (int)$cntStmt->fetchColumn();

            // Rows
            $stmt = $pdo->prepare("SELECT * FROM contact_messages $where ORDER BY created_at DESC LIMIT $limit OFFSET $offset");
            $stmt->execute($params);
            $contacts = $stmt->fetchAll(PDO::FETCH_ASSOC);
        } catch (\PDOException $e) {
            error_log("Contacts list error: " . $e->getMessage());
        }
    }

    sendResponse(true, 'Contacts retrieved', [
        'total'    => $total,
        'contacts' => $contacts
    ]);
}

// 2. UPDATE STATUS
if ($action === 'update_status') {
    $id = (int)($_POST['id'] ?? 0);
    $status = trim($_POST['status'] ?? '');
    $allowed = ['new', 'contacted', 'resolved', 'archived'];

    if (!$id || !in_array($status, $allowed)) {
        sendResponse(false, 'Invalid ID or status value.', [], 400);
    }

    if ($pdo) {
        $stmt = $pdo->prepare("UPDATE contact_messages SET status = :st WHERE id = :id");
        $stmt->execute([':st' => $status, ':id' => $id]);
    }
    sendResponse(true, "Contact inquiry #$id marked as $status");
}

// 3. DELETE INQUIRY
if ($action === 'delete') {
    $id = (int)($_POST['id'] ?? 0);
    if (!$id) {
        sendResponse(false, 'Valid inquiry ID is required.', [], 400);
    }

    if ($pdo) {
        $stmt = $pdo->prepare("DELETE FROM contact_messages WHERE id = :id");
        $stmt->execute([':id' => $id]);
    }
    sendResponse(true, "Inquiry #$id deleted successfully.");
}

// 4. EXPORT CSV
if ($action === 'export_csv') {
    if ($pdo) {
        $stmt = $pdo->query("SELECT id, name, email, phone, service, message, status, created_at FROM contact_messages ORDER BY id DESC");
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        header('Content-Type: text/csv; charset=utf-8');
        header('Content-Disposition: attachment; filename=vyomantra_contacts_' . date('Ymd_His') . '.csv');
        $out = fopen('php://output', 'w');
        fputcsv($out, ['ID', 'Name', 'Email', 'Phone', 'Service', 'Message', 'Status', 'Date']);
        foreach ($rows as $r) {
            fputcsv($out, $r);
        }
        fclose($out);
        exit;
    }
}

sendResponse(false, 'Invalid contact action', [], 400);
