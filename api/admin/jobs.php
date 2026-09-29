<?php
/**
 * Vyomantra Technologies - Admin Job Postings & CMS Endpoint
 */

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/job-builder.php';

$adminUser = checkAdminAuth();
$pdo = getDbConnection();

$action = trim($_POST['action'] ?? $_GET['action'] ?? 'list');

// 1. LIST JOBS
if ($action === 'list') {
    $status   = trim($_GET['status'] ?? 'all');
    $category = trim($_GET['category'] ?? 'all');
    $search   = trim($_GET['search'] ?? '');

    $jobs = [];

    if ($pdo) {
        try {
            $where = "WHERE 1=1";
            $params = [];

            if ($status !== 'all') {
                $where .= " AND j.status = :st";
                $params[':st'] = $status;
            }
            if ($category !== 'all') {
                $where .= " AND j.category = :cat";
                $params[':cat'] = $category;
            }
            if (!empty($search)) {
                $where .= " AND (j.title LIKE :s OR j.summary LIKE :s)";
                $params[':s'] = "%$search%";
            }

            // Fetch with applicant counts
            $sql = "
                SELECT j.*, 
                       (SELECT COUNT(*) FROM job_applications a WHERE a.role_applied = j.title) as applicant_count
                FROM job_postings j
                $where
                ORDER BY j.date_posted DESC, j.id DESC
            ";
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
            error_log("Jobs list DB error: " . $e->getMessage());
        }
    }

    // Fallback to data/jobs.json if DB unavailable or empty
    if (empty($jobs)) {
        $jsonFile = __DIR__ . '/../../data/jobs.json';
        if (file_exists($jsonFile)) {
            $all = json_decode(file_get_contents($jsonFile), true) ?: [];
            foreach ($all as $j) {
                if ($status !== 'all' && ($j['status'] ?? 'active') !== $status) {
                    continue;
                }
                if ($category !== 'all' && ($j['category'] ?? '') !== $category) {
                    continue;
                }
                if (!empty($search)) {
                    $haystack = strtolower(($j['title'] ?? '') . ' ' . ($j['summary'] ?? ''));
                    if (strpos($haystack, strtolower($search)) === false) {
                        continue;
                    }
                }
                $j['applicant_count'] = 0;
                $jobs[] = $j;
            }
        }
    }

    sendResponse(true, 'Job postings retrieved', ['jobs' => $jobs]);
}

// 2. GET SINGLE JOB
if ($action === 'get_one') {
    $id = (int)($_GET['id'] ?? 0);
    $slug = trim($_GET['slug'] ?? '');

    $job = null;
    if ($pdo) {
        $stmt = $pdo->prepare("SELECT * FROM job_postings WHERE id = :id OR slug = :slug LIMIT 1");
        $stmt->execute([':id' => $id, ':slug' => $slug]);
        $job = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($job) {
            $job['responsibilities'] = json_decode($job['responsibilities'] ?? '[]', true) ?: [];
            $job['competencies']     = json_decode($job['competencies'] ?? '[]', true) ?: [];
            $job['tech_stack']       = json_decode($job['tech_stack'] ?? '[]', true) ?: [];
        }
    }

    if (!$job) {
        $jsonFile = __DIR__ . '/../../data/jobs.json';
        if (file_exists($jsonFile)) {
            $all = json_decode(file_get_contents($jsonFile), true) ?: [];
            foreach ($all as $j) {
                if (($id && ($j['id'] ?? 0) === $id) || ($slug && ($j['slug'] ?? '') === $slug)) {
                    $job = $j;
                    break;
                }
            }
        }
    }

    if (!$job) {
        sendResponse(false, 'Job not found', [], 404);
    }
    sendResponse(true, 'Job found', ['job' => $job]);
}

// 3. SAVE (CREATE OR UPDATE) JOB
if ($action === 'save') {
    $id                = (int)($_POST['id'] ?? 0);
    $title             = trim($_POST['title'] ?? '');
    $category          = trim($_POST['category'] ?? 'engineering');
    $deptLabel         = trim($_POST['department_label'] ?? '');
    $jobType           = trim($_POST['job_type'] ?? 'fulltime');
    $workMode          = trim($_POST['work_mode'] ?? 'hybrid');
    $expLevel          = trim($_POST['experience_level'] ?? 'experienced');
    $expText           = trim($_POST['experience_text'] ?? '');
    $locationText      = trim($_POST['location_text'] ?? 'Dharmapuri, TN / Hybrid');
    $compensationText  = trim($_POST['compensation_text'] ?? 'Competitive CTC');
    $summary           = trim($_POST['summary'] ?? '');
    $aboutRole         = trim($_POST['about_role'] ?? '');
    $qualifications    = trim($_POST['qualifications'] ?? '');
    $status            = trim($_POST['status'] ?? 'active');
    $datePosted        = trim($_POST['date_posted'] ?? date('Y-m-d'));

    if (empty($title) || empty($summary)) {
        sendResponse(false, 'Job Title and Summary are required.', [], 400);
    }

    if (empty($deptLabel)) {
        $deptMap = [
            'engineering' => 'Engineering & Development',
            'ai'          => 'AI & Data Science',
            'design'      => 'Design & UI/UX',
            'marketing'   => 'Marketing & Growth'
        ];
        $deptLabel = $deptMap[$category] ?? 'Technology';
    }

    // Process lists (array or newline-separated string)
    $respRaw = $_POST['responsibilities'] ?? [];
    if (!is_array($respRaw)) {
        $respList = array_values(array_filter(array_map('trim', explode("\n", $respRaw))));
    } else {
        $respList = $respRaw;
    }

    $compRaw = $_POST['competencies'] ?? [];
    if (!is_array($compRaw)) {
        $compList = array_values(array_filter(array_map('trim', explode("\n", $compRaw))));
    } else {
        $compList = $compRaw;
    }

    $techRaw = $_POST['tech_stack'] ?? '';
    if (is_array($techRaw)) {
        $techList = $techRaw;
    } else {
        $techList = array_values(array_filter(array_map('trim', explode(',', $techRaw))));
    }

    // Slug generation
    $slug = trim($_POST['slug'] ?? '');
    if (empty($slug)) {
        $slug = strtolower(preg_replace('/[^a-zA-Z0-9]+/', '-', $title));
        $slug = trim($slug, '-');
    }

    $jobPayload = [
        'id'                => $id ?: time(),
        'slug'              => $slug,
        'title'             => $title,
        'category'          => $category,
        'department_label'  => $deptLabel,
        'job_type'          => $jobType,
        'work_mode'         => $workMode,
        'experience_level'  => $expLevel,
        'experience_text'   => $expText,
        'location_text'     => $locationText,
        'compensation_text' => $compensationText,
        'summary'           => $summary,
        'about_role'        => $aboutRole,
        'responsibilities'  => $respList,
        'qualifications'    => $qualifications,
        'competencies'      => $compList,
        'tech_stack'        => $techList,
        'status'            => $status,
        'date_posted'       => $datePosted,
        'subpage_url'       => 'careers/' . $slug . '.html'
    ];

    // Database Insert/Update
    if ($pdo) {
        try {
            if ($id > 0) {
                $sql = "UPDATE job_postings SET 
                        slug = :slug, title = :title, category = :cat, department_label = :dept,
                        job_type = :type, work_mode = :mode, experience_level = :exp_lvl,
                        experience_text = :exp_txt, location_text = :loc, compensation_text = :comp,
                        summary = :sum, about_role = :about, responsibilities = :resp,
                        qualifications = :qual, competencies = :comp_list, tech_stack = :tech,
                        status = :st, date_posted = :dp
                        WHERE id = :id";
                $stmt = $pdo->prepare($sql);
                $stmt->execute([
                    ':slug'      => $slug,
                    ':title'     => $title,
                    ':cat'       => $category,
                    ':dept'      => $deptLabel,
                    ':type'      => $jobType,
                    ':mode'      => $workMode,
                    ':exp_lvl'   => $expLevel,
                    ':exp_txt'   => $expText,
                    ':loc'       => $locationText,
                    ':comp'      => $compensationText,
                    ':sum'       => $summary,
                    ':about'     => $aboutRole,
                    ':resp'      => json_encode($respList, JSON_UNESCAPED_UNICODE),
                    ':qual'      => $qualifications,
                    ':comp_list' => json_encode($compList, JSON_UNESCAPED_UNICODE),
                    ':tech'      => json_encode($techList, JSON_UNESCAPED_UNICODE),
                    ':st'        => $status,
                    ':dp'        => $datePosted,
                    ':id'        => $id
                ]);
            } else {
                $sql = "INSERT INTO job_postings 
                        (slug, title, category, department_label, job_type, work_mode, experience_level,
                         experience_text, location_text, compensation_text, summary, about_role,
                         responsibilities, qualifications, competencies, tech_stack, status, date_posted)
                        VALUES
                        (:slug, :title, :cat, :dept, :type, :mode, :exp_lvl,
                         :exp_txt, :loc, :comp, :sum, :about,
                         :resp, :qual, :comp_list, :tech, :st, :dp)";
                $stmt = $pdo->prepare($sql);
                $stmt->execute([
                    ':slug'      => $slug,
                    ':title'     => $title,
                    ':cat'       => $category,
                    ':dept'      => $deptLabel,
                    ':type'      => $jobType,
                    ':mode'      => $workMode,
                    ':exp_lvl'   => $expLevel,
                    ':exp_txt'   => $expText,
                    ':loc'       => $locationText,
                    ':comp'      => $compensationText,
                    ':sum'       => $summary,
                    ':about'     => $aboutRole,
                    ':resp'      => json_encode($respList, JSON_UNESCAPED_UNICODE),
                    ':qual'      => $qualifications,
                    ':comp_list' => json_encode($compList, JSON_UNESCAPED_UNICODE),
                    ':tech'      => json_encode($techList, JSON_UNESCAPED_UNICODE),
                    ':st'        => $status,
                    ':dp'        => $datePosted
                ]);
                $jobPayload['id'] = (int)$pdo->lastInsertId();
            }
        } catch (\PDOException $e) {
            error_log("Job save error: " . $e->getMessage());
        }
    }

    // Update JSON Cache
    $jsonFile = __DIR__ . '/../../data/jobs.json';
    $existingJobs = [];
    if (file_exists($jsonFile)) {
        $existingJobs = json_decode(file_get_contents($jsonFile), true) ?: [];
    }

    $foundIndex = -1;
    foreach ($existingJobs as $idx => $ex) {
        if (($id && ($ex['id'] ?? 0) === $id) || ($ex['slug'] ?? '') === $slug) {
            $foundIndex = $idx;
            break;
        }
    }

    if ($foundIndex >= 0) {
        $existingJobs[$foundIndex] = array_merge($existingJobs[$foundIndex], $jobPayload);
    } else {
        array_unshift($existingJobs, $jobPayload);
    }
    syncJobsJsonFile($existingJobs);

    // Compile Static HTML Subpage
    $subpageCompiled = generateJobSubpage($jobPayload);

    sendResponse(true, ($id ? 'Job updated' : 'New job posted successfully') . ($subpageCompiled ? ' & static page generated.' : '.'), [
        'job' => $jobPayload
    ]);
}

// 4. UPDATE STATUS
if ($action === 'update_status') {
    $id     = (int)($_POST['id'] ?? 0);
    $slug   = trim($_POST['slug'] ?? '');
    $status = trim($_POST['status'] ?? '');
    $allowed= ['active', 'reviewing', 'closed', 'draft'];

    if (!$status || !in_array($status, $allowed)) {
        sendResponse(false, 'Invalid status.', [], 400);
    }

    if ($pdo && $id) {
        $stmt = $pdo->prepare("UPDATE job_postings SET status = :st WHERE id = :id");
        $stmt->execute([':st' => $status, ':id' => $id]);
    }

    // Sync JSON
    $jsonFile = __DIR__ . '/../../data/jobs.json';
    if (file_exists($jsonFile)) {
        $all = json_decode(file_get_contents($jsonFile), true) ?: [];
        foreach ($all as &$j) {
            if (($id && ($j['id'] ?? 0) === $id) || ($slug && ($j['slug'] ?? '') === $slug)) {
                $j['status'] = $status;
                break;
            }
        }
        syncJobsJsonFile($all);
    }

    sendResponse(true, "Job status changed to $status.");
}

// 5. DELETE JOB
if ($action === 'delete') {
    $id   = (int)($_POST['id'] ?? 0);
    $slug = trim($_POST['slug'] ?? '');

    if (!$id && !$slug) {
        sendResponse(false, 'Valid ID or slug required.', [], 400);
    }

    if ($pdo) {
        $stmt = $pdo->prepare("DELETE FROM job_postings WHERE id = :id OR slug = :slug");
        $stmt->execute([':id' => $id, ':slug' => $slug]);
    }

    // Sync JSON
    $jsonFile = __DIR__ . '/../../data/jobs.json';
    if (file_exists($jsonFile)) {
        $all = json_decode(file_get_contents($jsonFile), true) ?: [];
        $all = array_values(array_filter($all, function($j) use ($id, $slug) {
            if ($id && ($j['id'] ?? 0) === $id) return false;
            if ($slug && ($j['slug'] ?? '') === $slug) return false;
            return true;
        }));
        syncJobsJsonFile($all);
    }

    sendResponse(true, "Job removed successfully.");
}

sendResponse(false, 'Invalid jobs action', [], 400);
