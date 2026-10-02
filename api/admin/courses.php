<?php
header('X-Robots-Tag: noindex, nofollow', true);
/**
 * Vyomantra Technologies - Admin Course Creation CMS & Admissions Endpoint
 */

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/auth.php';

$adminUser = checkAdminAuth();
$pdo = getDbConnection();

$action = trim($_POST['action'] ?? $_GET['action'] ?? 'list');

// Helper to get or sync data/courses.json
function getCoursesJsonFile() {
    return __DIR__ . '/../../data/courses.json';
}

function loadCoursesFromJson() {
    $file = getCoursesJsonFile();
    if (!file_exists($file)) return [];
    return json_decode(file_get_contents($file), true) ?: [];
}

function saveCoursesToJson($courses) {
    $file = getCoursesJsonFile();
    file_put_contents($file, json_encode($courses, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));
}

// =========================================================================
// COURSE CMS ACTIONS (Like Job Postings CMS)
// =========================================================================

// 1. LIST COURSES (CMS)
if ($action === 'list_courses') {
    $status   = trim($_GET['status'] ?? 'all');
    $category = trim($_GET['category'] ?? 'all');
    $search   = trim($_GET['search'] ?? '');

    $courses = [];

    if ($pdo) {
        try {
            $where = "WHERE 1=1";
            $params = [];

            if ($status !== 'all') {
                $where .= " AND c.status = :st";
                $params[':st'] = $status;
            }
            if ($category !== 'all') {
                $where .= " AND c.category = :cat";
                $params[':cat'] = $category;
            }
            if (!empty($search)) {
                $where .= " AND (c.title LIKE :s OR c.summary LIKE :s)";
                $params[':s'] = "%$search%";
            }

            $sql = "
                SELECT c.*,
                       (SELECT COUNT(*) FROM course_registrations r WHERE r.course_name = c.title) as student_count
                FROM courses c
                $where
                ORDER BY c.id DESC
            ";
            $stmt = $pdo->prepare($sql);
            $stmt->execute($params);
            $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

            foreach ($rows as $r) {
                $r['syllabus'] = json_decode($r['syllabus'] ?? '[]', true) ?: [];
                $r['features'] = json_decode($r['features'] ?? '[]', true) ?: [];
                $courses[] = $r;
            }
        } catch (\PDOException $e) {
            error_log("Courses list DB error: " . $e->getMessage());
        }
    }

    // Fallback to data/courses.json
    if (empty($courses)) {
        $all = loadCoursesFromJson();
        foreach ($all as $c) {
            if ($status !== 'all' && ($c['status'] ?? 'active') !== $status) continue;
            if ($category !== 'all' && ($c['category'] ?? '') !== $category) continue;
            if (!empty($search)) {
                $haystack = strtolower(($c['title'] ?? '') . ' ' . ($c['summary'] ?? ''));
                if (strpos($haystack, strtolower($search)) === false) continue;
            }
            $c['student_count'] = 0;
            $courses[] = $c;
        }
    }

    sendResponse(true, 'Courses retrieved', ['courses' => $courses]);
}

// 2. GET SINGLE COURSE
if ($action === 'get_course') {
    $id = (int)($_GET['id'] ?? 0);
    $slug = trim($_GET['slug'] ?? '');

    $course = null;
    if ($pdo) {
        $stmt = $pdo->prepare("SELECT * FROM courses WHERE id = :id OR slug = :slug LIMIT 1");
        $stmt->execute([':id' => $id, ':slug' => $slug]);
        $course = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($course) {
            $course['syllabus'] = json_decode($course['syllabus'] ?? '[]', true) ?: [];
            $course['features'] = json_decode($course['features'] ?? '[]', true) ?: [];
        }
    }

    if (!$course) {
        $all = loadCoursesFromJson();
        foreach ($all as $c) {
            if (($id && ($c['id'] ?? 0) === $id) || ($slug && ($c['slug'] ?? '') === $slug)) {
                $course = $c;
                break;
            }
        }
    }

    if (!$course) {
        sendResponse(false, 'Course not found', [], 404);
    }

    sendResponse(true, 'Course retrieved', ['course' => $course]);
}

// 3. SAVE COURSE (CREATE OR UPDATE)
if ($action === 'save_course') {
    $id             = (int)($_POST['id'] ?? 0);
    $title          = trim($_POST['title'] ?? '');
    $slug           = trim($_POST['slug'] ?? '');
    $badge          = trim($_POST['badge'] ?? 'Live Online Cohort');
    $category       = trim($_POST['category'] ?? 'programming');
    $duration       = trim($_POST['duration'] ?? '1 Month');
    $mode           = trim($_POST['mode'] ?? 'Live Online');
    $fee            = (float)($_POST['fee'] ?? 649);
    $original_fee   = (float)($_POST['original_fee'] ?? 24999);
    $seats_label    = trim($_POST['seats_label'] ?? 'Seats Limited');
    $summary        = trim($_POST['summary'] ?? '');
    $mentor_name    = trim($_POST['mentor_name'] ?? 'VYOMANTRA Technical Lead');
    $whatsapp_phone = trim($_POST['whatsapp_phone'] ?? '918122288855');
    $status         = trim($_POST['status'] ?? 'active');

    if (empty($title)) {
        sendResponse(false, 'Course title is required.', [], 400);
    }

    if (empty($slug)) {
        $slug = strtolower(preg_replace('/[^a-z0-9]+/i', '-', $title));
        $slug = trim($slug, '-');
    }

    // Process syllabus (one per line)
    $syllabusRaw = $_POST['syllabus'] ?? [];
    if (is_string($syllabusRaw)) {
        $syllabus = array_values(array_filter(array_map('trim', explode("\n", $syllabusRaw))));
    } else {
        $syllabus = (array)$syllabusRaw;
    }

    // Process features (one per line or array)
    $featuresRaw = $_POST['features'] ?? [];
    if (is_string($featuresRaw)) {
        $features = array_values(array_filter(array_map('trim', explode("\n", $featuresRaw))));
    } else {
        $features = (array)$featuresRaw;
    }

    $savedId = $id;

    if ($pdo) {
        try {
            if ($id > 0) {
                $sql = "UPDATE courses SET
                    title = :title, slug = :slug, badge = :badge, category = :category,
                    duration = :duration, mode = :mode, fee = :fee, original_fee = :orig_fee,
                    seats_label = :seats, summary = :summary, syllabus = :syllabus,
                    features = :features, mentor_name = :mentor, whatsapp_phone = :wa,
                    status = :status, updated_at = NOW()
                    WHERE id = :id";
                $stmt = $pdo->prepare($sql);
                $stmt->execute([
                    ':title'     => $title,
                    ':slug'      => $slug,
                    ':badge'     => $badge,
                    ':category'  => $category,
                    ':duration'  => $duration,
                    ':mode'      => $mode,
                    ':fee'       => $fee,
                    ':orig_fee'  => $original_fee,
                    ':seats'     => $seats_label,
                    ':summary'   => $summary,
                    ':syllabus'  => json_encode($syllabus, JSON_UNESCAPED_UNICODE),
                    ':features'  => json_encode($features, JSON_UNESCAPED_UNICODE),
                    ':mentor'    => $mentor_name,
                    ':wa'        => $whatsapp_phone,
                    ':status'    => $status,
                    ':id'        => $id
                ]);
            } else {
                $sql = "INSERT INTO courses (
                    title, slug, badge, category, duration, mode, fee, original_fee,
                    seats_label, summary, syllabus, features, mentor_name, whatsapp_phone, status, created_at
                ) VALUES (
                    :title, :slug, :badge, :category, :duration, :mode, :fee, :orig_fee,
                    :seats, :summary, :syllabus, :features, :mentor, :wa, :status, NOW()
                )";
                $stmt = $pdo->prepare($sql);
                $stmt->execute([
                    ':title'     => $title,
                    ':slug'      => $slug,
                    ':badge'     => $badge,
                    ':category'  => $category,
                    ':duration'  => $duration,
                    ':mode'      => $mode,
                    ':fee'       => $fee,
                    ':orig_fee'  => $original_fee,
                    ':seats'     => $seats_label,
                    ':summary'   => $summary,
                    ':syllabus'  => json_encode($syllabus, JSON_UNESCAPED_UNICODE),
                    ':features'  => json_encode($features, JSON_UNESCAPED_UNICODE),
                    ':mentor'    => $mentor_name,
                    ':wa'        => $whatsapp_phone,
                    ':status'    => $status
                ]);
                $savedId = (int)$pdo->lastInsertId();
            }
        } catch (\PDOException $e) {
            error_log("Save course DB error: " . $e->getMessage());
        }
    }

    if (!$savedId) {
        $savedId = $id > 0 ? $id : (int)(microtime(true) * 1000);
    }

    // Synchronize to data/courses.json
    $all = loadCoursesFromJson();
    $courseData = [
        'id'             => $savedId,
        'title'          => $title,
        'slug'           => $slug,
        'badge'          => $badge,
        'category'       => $category,
        'duration'       => $duration,
        'mode'           => $mode,
        'fee'            => $fee,
        'original_fee'   => $original_fee,
        'seats_label'    => $seats_label,
        'summary'        => $summary,
        'syllabus'       => $syllabus,
        'features'       => $features,
        'mentor_name'    => $mentor_name,
        'whatsapp_phone' => $whatsapp_phone,
        'status'         => $status,
        'updated_at'     => date('Y-m-d H:i:s')
    ];

    $found = false;
    foreach ($all as &$c) {
        if (($c['id'] ?? 0) === $savedId || ($c['slug'] ?? '') === $slug) {
            $c = $courseData;
            $found = true;
            break;
        }
    }
    if (!$found) {
        $all[] = $courseData;
    }
    saveCoursesToJson($all);

    sendResponse(true, 'Course saved and published successfully', [
        'id'     => $savedId,
        'slug'   => $slug,
        'status' => $status
    ]);
}

// 4. DELETE COURSE
if ($action === 'delete_course') {
    $id = (int)($_POST['id'] ?? 0);
    if (!$id) {
        sendResponse(false, 'Valid course ID is required.', [], 400);
    }

    if ($pdo) {
        try {
            $stmt = $pdo->prepare("DELETE FROM courses WHERE id = :id");
            $stmt->execute([':id' => $id]);
        } catch (\PDOException $e) {
            error_log("Delete course DB error: " . $e->getMessage());
        }
    }

    // Delete from data/courses.json
    $all = loadCoursesFromJson();
    $filtered = array_values(array_filter($all, function($c) use ($id) {
        return ($c['id'] ?? 0) !== $id;
    }));
    saveCoursesToJson($filtered);

    sendResponse(true, "Course #$id removed successfully.");
}

// 5. TOGGLE COURSE STATUS
if ($action === 'toggle_course_status') {
    $id = (int)($_POST['id'] ?? 0);
    $status = trim($_POST['status'] ?? 'active');
    $allowed = ['active', 'upcoming', 'closed', 'draft'];

    if (!$id || !in_array($status, $allowed)) {
        sendResponse(false, 'Invalid ID or status value.', [], 400);
    }

    if ($pdo) {
        $stmt = $pdo->prepare("UPDATE courses SET status = :st, updated_at = NOW() WHERE id = :id");
        $stmt->execute([':st' => $status, ':id' => $id]);
    }

    $all = loadCoursesFromJson();
    foreach ($all as &$c) {
        if (($c['id'] ?? 0) === $id) {
            $c['status'] = $status;
            break;
        }
    }
    saveCoursesToJson($all);

    sendResponse(true, "Course #$id status updated to $status.");
}

// =========================================================================
// REGISTRATION & ADMISSION ACTIONS (Student verification)
// =========================================================================

// 6. LIST REGISTRATIONS
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

// 7. VERIFY PAYMENT STATUS
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

// 8. DELETE REGISTRATION
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

// 9. EXPORT CSV
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
