<?php
/**
 * Vyomantra Technologies - Public Jobs Listing Endpoint
 * Fetches active job openings and internships for careers.html
 */

require_once __DIR__ . '/config.php';

$category = trim($_GET['category'] ?? 'all');
$type     = trim($_GET['type'] ?? 'all');
$mode     = trim($_GET['mode'] ?? 'all');
$search   = trim($_GET['search'] ?? '');

$pdo = getDbConnection();
$jobs = [];

if ($pdo) {
    try {
        $sql = "SELECT * FROM `job_postings` WHERE `status` = 'active'";
        $params = [];

        if ($category !== 'all') {
            $sql .= " AND `category` = :cat";
            $params[':cat'] = $category;
        }
        if ($type !== 'all') {
            $sql .= " AND `job_type` = :type";
            $params[':type'] = $type;
        }
        if ($mode !== 'all') {
            $sql .= " AND `work_mode` = :mode";
            $params[':mode'] = $mode;
        }
        if (!empty($search)) {
            $sql .= " AND (`title` LIKE :s OR `summary` LIKE :s OR `tech_stack` LIKE :s)";
            $params[':s'] = '%' . $search . '%';
        }

        $sql .= " ORDER BY `date_posted` DESC, `id` DESC";
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        foreach ($rows as $r) {
            $r['responsibilities'] = json_decode($r['responsibilities'] ?? '[]', true) ?: [];
            $r['competencies']     = json_decode($r['competencies'] ?? '[]', true) ?: [];
            $r['tech_stack']       = json_decode($r['tech_stack'] ?? '[]', true) ?: [];
            $r['subpage_url']      = 'careers/' . $r['slug'] . '.html';
            $jobs[] = $r;
        }
    } catch (\PDOException $e) {
        error_log("Get jobs DB error: " . $e->getMessage());
        $jobs = [];
    }
}

// Fallback to data/jobs.json if DB unavailable or empty
if (empty($jobs)) {
    $jsonFile = __DIR__ . '/../data/jobs.json';
    if (file_exists($jsonFile)) {
        $raw = file_get_contents($jsonFile);
        $all = json_decode($raw, true) ?: [];
        foreach ($all as $j) {
            if (($j['status'] ?? 'active') !== 'active') {
                continue;
            }
            if ($category !== 'all' && ($j['category'] ?? '') !== $category) {
                continue;
            }
            if ($type !== 'all' && ($j['job_type'] ?? '') !== $type) {
                continue;
            }
            if ($mode !== 'all' && ($j['work_mode'] ?? '') !== $mode) {
                continue;
            }
            if (!empty($search)) {
                $haystack = strtolower(($j['title'] ?? '') . ' ' . ($j['summary'] ?? '') . ' ' . implode(' ', $j['tech_stack'] ?? []));
                if (strpos($haystack, strtolower($search)) === false) {
                    continue;
                }
            }
            $jobs[] = $j;
        }
    }
}

sendResponse(true, 'Active jobs retrieved successfully', [
    'total' => count($jobs),
    'jobs'  => $jobs
]);
