<?php
/**
 * End-to-End HTTP Test Suite for Vyomantra Certificate Verification System
 * Tests against real running PHP server at http://127.0.0.1:8088
 */

$baseUrl = 'http://127.0.0.1:8088';
echo "=======================================================\n";
echo "VYOMANTRA TECHNOLOGIES - CERTIFICATE HTTP TEST SUITE\n";
echo "Testing Server: $baseUrl\n";
echo "=======================================================\n\n";

$testsPassed = 0;
$testsTotal = 0;

function httpRequest($url, $method = 'GET', $data = [], $headers = []) {
    $ch = curl_init();
    $opts = [
        CURLOPT_URL => $url,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HEADER => true,
        CURLOPT_TIMEOUT => 10,
        CURLOPT_HTTPHEADER => $headers
    ];

    if ($method === 'POST') {
        $opts[CURLOPT_POST] = true;
        $opts[CURLOPT_POSTFIELDS] = http_build_query($data);
    }

    curl_setopt_array($ch, $opts);
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $headerSize = curl_getinfo($ch, CURLINFO_HEADER_SIZE);
    curl_close($ch);

    $body = substr($response, $headerSize);
    return [
        'code' => $httpCode,
        'body' => $body,
        'json' => json_decode($body, true)
    ];
}

function runTestCase($name, $callable) {
    global $testsPassed, $testsTotal;
    $testsTotal++;
    echo "[TEST $testsTotal] $name ... ";
    try {
        $res = $callable();
        if ($res === true) {
            echo "PASSED\n";
            $testsPassed++;
        } else {
            echo "FAILED: $res\n";
        }
    } catch (Exception $e) {
        echo "EXCEPTION: " . $e->getMessage() . "\n";
    }
}

// 1. Verify Valid Certificate
runTestCase("Public verify.php: Valid Certificate (VYOM-PY-2026-00001)", function() use ($baseUrl) {
    $res = httpRequest("$baseUrl/api/verify.php?id=VYOM-PY-2026-00001&method=QR_SCAN");
    if ($res['code'] !== 200) return "Expected HTTP 200, got {$res['code']}";
    $json = $res['json'];
    if (!$json || !($json['success'] ?? false)) return "Expected success=true";
    if (($json['data']['status'] ?? '') !== 'valid') return "Expected status=valid, got: " . ($json['data']['status'] ?? '');
    if (($json['data']['recipient_name'] ?? '') !== 'Kavitha R') return "Expected recipient Kavitha R";
    if (isset($json['data']['recipient_email'])) return "Privacy leak: recipient_email exposed";
    if (isset($json['data']['private_notes'])) return "Privacy leak: private_notes exposed";
    return true;
});

// 2. Verify Revoked Certificate
runTestCase("Public verify.php: Revoked Certificate (VYOM-WKS-2026-00004)", function() use ($baseUrl) {
    $res = httpRequest("$baseUrl/api/verify.php?id=VYOM-WKS-2026-00004&method=MANUAL_ID");
    if ($res['code'] !== 200) return "Expected HTTP 200, got {$res['code']}";
    $json = $res['json'];
    if (($json['data']['status'] ?? '') !== 'revoked') return "Expected status=revoked";
    if (empty($json['data']['revocation_reason'])) return "Expected revocation_reason to be non-empty";
    return true;
});

// 3. Verify Expired Certificate
runTestCase("Public verify.php: Expired Certificate (VYOM-CRT-2025-00005)", function() use ($baseUrl) {
    $res = httpRequest("$baseUrl/api/verify.php?id=VYOM-CRT-2025-00005&method=QR_SCAN");
    if ($res['code'] !== 200) return "Expected HTTP 200, got {$res['code']}";
    $json = $res['json'];
    if (($json['data']['status'] ?? '') !== 'expired') return "Expected status=expired";
    return true;
});

// 4. Verify Non-Existent Certificate
runTestCase("Public verify.php: Non-Existent ID returns 404 & not_found", function() use ($baseUrl) {
    $res = httpRequest("$baseUrl/api/verify.php?id=VYOM-UNKNOWN-88888");
    if ($res['code'] !== 404) return "Expected HTTP 404, got {$res['code']}";
    $json = $res['json'];
    if (($json['data']['status'] ?? '') !== 'not_found') return "Expected status=not_found";
    return true;
});

// 5. Admin API: Unauthorized access protection
runTestCase("Admin API: Reject request without Bearer token (401 Unauthorized)", function() use ($baseUrl) {
    $res = httpRequest("$baseUrl/api/admin/certificates.php?action=list");
    if ($res['code'] !== 401) return "Expected HTTP 401, got {$res['code']}";
    return true;
});

// 6. Admin Authentication & Login
$adminToken = null;
runTestCase("Admin API: Authenticate / Login to retrieve auth token", function() use ($baseUrl, &$adminToken) {
    $res = httpRequest("$baseUrl/api/admin/auth.php", 'POST', [
        'action'   => 'login',
        'username' => 'admin',
        'password' => 'Vyomantra@2026'
    ]);
    if ($res['code'] !== 200) return "Expected HTTP 200, got {$res['code']}";
    $json = $res['json'];
    if (!$json || !($json['success'] ?? false)) return "Login failed";
    $adminToken = $json['data']['token'] ?? null;
    if (!$adminToken) return "No token returned";
    return true;
});

// 7. Admin API: List certificates
runTestCase("Admin API: List certificates with authentication", function() use ($baseUrl, &$adminToken) {
    $res = httpRequest("$baseUrl/api/admin/certificates.php?action=list", 'GET', [], [
        "Authorization: Bearer $adminToken"
    ]);
    if ($res['code'] !== 200) return "Expected HTTP 200, got {$res['code']}";
    $json = $res['json'];
    if (!isset($json['data']['certificates'])) return "Missing certificates array";
    if (count($json['data']['certificates']) < 3) return "Expected at least 3 seed certificates";
    return true;
});

// 8. Admin API: Create Certificate with Unique ID & Token
$createdCertId = null;
runTestCase("Admin API: Create new Certificate (Auto ID & QR Verification URL)", function() use ($baseUrl, &$adminToken, &$createdCertId) {
    $res = httpRequest("$baseUrl/api/admin/certificates.php", 'POST', [
        'action'           => 'create',
        'prefix'           => 'VYOM-INT',
        'recipient_name'   => 'Deepa Narayanan',
        'recipient_email'  => 'deepa.n@example.com',
        'course_name'      => 'Artificial Intelligence & Machine Learning Internship',
        'course_duration'  => '6 Months',
        'issue_date'       => '2026-09-28',
        'certificate_type' => 'Internship Certificate',
        'status'           => 'valid',
        'private_notes'    => 'Automated test suite issued'
    ], [
        "Authorization: Bearer $adminToken"
    ]);
    if ($res['code'] !== 201 && $res['code'] !== 200) return "Expected HTTP 201/200, got {$res['code']}: {$res['body']}";
    $json = $res['json'];
    $cert = $json['data']['certificate'] ?? [];
    $createdCertId = $cert['certificate_id'] ?? null;
    if (!$createdCertId) return "No certificate_id returned";
    if (!str_starts_with($createdCertId, 'VYOM-INT-2026-')) return "Invalid format: $createdCertId";
    if (empty($cert['verification_token'])) return "Missing verification_token";
    return true;
});

// 9. Verify newly created certificate immediately on public verification API
runTestCase("Public verify.php: Verify newly issued Certificate ($createdCertId)", function() use ($baseUrl, &$createdCertId) {
    $res = httpRequest("$baseUrl/api/verify.php?id=$createdCertId&method=QR_SCAN");
    if ($res['code'] !== 200) return "Expected HTTP 200, got {$res['code']}";
    $json = $res['json'];
    if (($json['data']['recipient_name'] ?? '') !== 'Deepa Narayanan') return "Recipient mismatch";
    if (($json['data']['status'] ?? '') !== 'valid') return "Expected status=valid";
    return true;
});

// 10. Admin API: Revoke Certificate
runTestCase("Admin API: Revoke certificate ($createdCertId)", function() use ($baseUrl, &$adminToken, &$createdCertId) {
    $res = httpRequest("$baseUrl/api/admin/certificates.php", 'POST', [
        'action' => 'revoke',
        'id'     => $createdCertId,
        'reason' => 'Honor code violation identified during audit'
    ], [
        "Authorization: Bearer $adminToken"
    ]);
    if ($res['code'] !== 200) return "Expected HTTP 200, got {$res['code']}";

    // Check public API returns revoked
    $vRes = httpRequest("$baseUrl/api/verify.php?id=$createdCertId");
    $vJson = $vRes['json'];
    if (($vJson['data']['status'] ?? '') !== 'revoked') return "Expected revoked status on public verification";
    if (($vJson['data']['revocation_reason'] ?? '') !== 'Honor code violation identified during audit') return "Revocation reason mismatch";
    return true;
});

// 11. Admin API: Restore Certificate
runTestCase("Admin API: Restore certificate back to VALID ($createdCertId)", function() use ($baseUrl, &$adminToken, &$createdCertId) {
    $res = httpRequest("$baseUrl/api/admin/certificates.php", 'POST', [
        'action' => 'restore',
        'id'     => $createdCertId
    ], [
        "Authorization: Bearer $adminToken"
    ]);
    if ($res['code'] !== 200) return "Expected HTTP 200, got {$res['code']}";

    // Check public API reflects valid again
    $vRes = httpRequest("$baseUrl/api/verify.php?id=$createdCertId");
    $vJson = $vRes['json'];
    if (($vJson['data']['status'] ?? '') !== 'valid') return "Expected valid status after restore";
    return true;
});

// 12. Admin Stats API: returns certificate counters
runTestCase("Admin API: stats.php includes certificate counts & overview", function() use ($baseUrl, &$adminToken) {
    $res = httpRequest("$baseUrl/api/admin/stats.php", 'GET', [], [
        "Authorization: Bearer $adminToken"
    ]);
    if ($res['code'] !== 200) return "Expected HTTP 200, got {$res['code']}";
    $json = $res['json'];
    if (!isset($json['data']['certificates'])) return "Missing certificates key in stats";
    if (($json['data']['certificates']['total'] ?? 0) < 1) return "Certificates total count is 0 in stats";
    return true;
});

echo "\n=======================================================\n";
echo "SUMMARY: $testsPassed / $testsTotal AUTOMATED TESTS PASSED\n";
echo "=======================================================\n";

if ($testsPassed === $testsTotal) {
    echo "SUCCESS: 100% OF TESTS PASSED!\n";
    exit(0);
} else {
    echo "FAILURE: SOME TESTS FAILED!\n";
    exit(1);
}
