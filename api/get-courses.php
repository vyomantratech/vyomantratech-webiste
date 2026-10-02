<?php
header('X-Robots-Tag: noindex, nofollow', true);
/**
 * Vyomantra Technologies - Public Courses Listing Endpoint
 * Fetches active/upcoming technical courses for courses.html
 */

require_once __DIR__ . '/config.php';

$category = trim($_GET['category'] ?? 'all');
$status   = trim($_GET['status'] ?? 'active');

$pdo = getDbConnection();
$courses = [];

if ($pdo) {
    try {
        $sql = "SELECT * FROM `courses` WHERE 1=1";
        $params = [];

        if ($status !== 'all') {
            $sql .= " AND `status` = :st";
            $params[':st'] = $status;
        }
        if ($category !== 'all') {
            $sql .= " AND `category` = :cat";
            $params[':cat'] = $category;
        }

        $sql .= " ORDER BY `id` DESC";
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        foreach ($rows as $r) {
            $r['syllabus'] = json_decode($r['syllabus'] ?? '[]', true) ?: [];
            $r['features'] = json_decode($r['features'] ?? '[]', true) ?: [];
            $courses[] = $r;
        }
    } catch (\PDOException $e) {
        error_log("Get courses DB error: " . $e->getMessage());
        $courses = [];
    }
}

// Fallback to data/courses.json if DB unavailable or empty
if (empty($courses)) {
    $jsonFile = __DIR__ . '/../data/courses.json';
    if (file_exists($jsonFile)) {
        $raw = file_get_contents($jsonFile);
        $all = json_decode($raw, true) ?: [];
        foreach ($all as $c) {
            if ($status !== 'all' && ($c['status'] ?? 'active') !== $status) {
                continue;
            }
            if ($category !== 'all' && ($c['category'] ?? '') !== $category) {
                continue;
            }
            $courses[] = $c;
        }
    }
}

sendResponse(true, 'Active courses retrieved successfully', [
    'total'   => count($courses),
    'courses' => $courses
]);
