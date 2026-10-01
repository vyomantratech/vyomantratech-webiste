<?php
header('X-Robots-Tag: noindex, nofollow', true);
/**
 * Vyomantra Technologies - Admin Authentication API
 * Secure Token-based Authentication & Access Control Guard
 */

require_once __DIR__ . '/../config.php';

// Common helper to authenticate all /api/admin/*.php requests
function checkAdminAuth() {
    $token = null;
    $headers = getallheaders();
    if (isset($headers['Authorization'])) {
        if (preg_match('/Bearer\s(\S+)/', $headers['Authorization'], $matches)) {
            $token = $matches[1];
        }
    }
    if (!$token && isset($_POST['token'])) {
        $token = trim($_POST['token']);
    }
    if (!$token && isset($_GET['token'])) {
        $token = trim($_GET['token']);
    }

    if (!$token) {
        sendResponse(false, 'Unauthorized access. Authentication token required.', [], 401);
    }

    $pdo = getDbConnection();
    if ($pdo) {
        try {
            $stmt = $pdo->prepare("SELECT id, username, email, full_name, role, token_expiry FROM admin_users WHERE auth_token = :token LIMIT 1");
            $stmt->execute([':token' => $token]);
            $user = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$user) {
                sendResponse(false, 'Session invalid or expired. Please login again.', [], 401);
            }

            if (!empty($user['token_expiry']) && strtotime($user['token_expiry']) < time()) {
                sendResponse(false, 'Session expired. Please log in again.', [], 401);
            }

            return $user;
        } catch (\PDOException $e) {
            error_log("Auth verification DB error: " . $e->getMessage());
        }
    }

    // Fallback file/token verification if DB not configured yet
    $tokenFile = __DIR__ . '/../../data/admin_session.json';
    if (file_exists($tokenFile)) {
        $session = json_decode(file_get_contents($tokenFile), true);
        if ($session && ($session['token'] ?? '') === $token) {
            if (($session['expiry'] ?? 0) > time()) {
                return $session['user'];
            }
        }
    }

    sendResponse(false, 'Unauthorized. Session expired.', [], 401);
}

// If this file is called directly as an endpoint (and not included by another script):
$isDirectEndpoint = false;
$scriptFile = $_SERVER['SCRIPT_FILENAME'] ?? '';
if (!empty($scriptFile) && realpath(__FILE__) === realpath($scriptFile)) {
    $isDirectEndpoint = true;
} elseif (!empty($_SERVER['PHP_SELF']) && basename($_SERVER['PHP_SELF']) === 'auth.php') {
    $isDirectEndpoint = true;
}

if ($isDirectEndpoint) {
    $action = trim($_POST['action'] ?? $_GET['action'] ?? '');

    if ($_SERVER['REQUEST_METHOD'] === 'POST') {

    // 1. LOGIN
    if ($action === 'login') {
        $username = trim($_POST['username'] ?? '');
        $password = trim($_POST['password'] ?? '');

        if (empty($username) || empty($password)) {
            sendResponse(false, 'Please provide both username and password.', [], 400);
        }

        $authenticatedUser = null;
        $pdo = getDbConnection();

        if ($pdo) {
            try {
                $stmt = $pdo->prepare("SELECT * FROM admin_users WHERE username = :u OR email = :u LIMIT 1");
                $stmt->execute([':u' => $username]);
                $user = $stmt->fetch(PDO::FETCH_ASSOC);

                if ($user) {
                    // Check password hash, or check initial fallback password and auto-upgrade
                    if (password_verify($password, $user['password_hash']) || ($password === 'Vyomantra@2026' && $user['username'] === 'admin')) {
                        // Re-hash if needed
                        if ($password === 'Vyomantra@2026' && !password_verify($password, $user['password_hash'])) {
                            $newHash = password_hash($password, PASSWORD_BCRYPT);
                            $upStmt = $pdo->prepare("UPDATE admin_users SET password_hash = :h WHERE id = :id");
                            $upStmt->execute([':h' => $newHash, ':id' => $user['id']]);
                        }
                        $authenticatedUser = $user;
                    }
                }
            } catch (\PDOException $e) {
                error_log("Login DB error: " . $e->getMessage());
            }
        }

        // Fallback default admin credentials (works even before MySQL setup)
        if (!$authenticatedUser && $username === 'admin' && $password === 'Vyomantra@2026') {
            $authenticatedUser = [
                'id'        => 1,
                'username'  => 'admin',
                'email'     => 'vyomantratech@gmail.com',
                'full_name' => 'Vyomantra Administrator',
                'role'      => 'super_admin'
            ];
        }

        if (!$authenticatedUser) {
            sendResponse(false, 'Invalid username or password.', [], 401);
        }

        // Generate Token
        $token = bin2hex(random_bytes(32));
        $expiryTime = time() + (24 * 60 * 60); // 24 hours
        $expiryDate = date('Y-m-d H:i:s', $expiryTime);

        if ($pdo && isset($authenticatedUser['id'])) {
            try {
                $stmt = $pdo->prepare("UPDATE admin_users SET auth_token = :token, token_expiry = :expiry, last_login = NOW() WHERE id = :id");
                $stmt->execute([
                    ':token'  => $token,
                    ':expiry' => $expiryDate,
                    ':id'     => $authenticatedUser['id']
                ]);
            } catch (\PDOException $e) {
                error_log("Token update error: " . $e->getMessage());
            }
        }

        // Save session cache to data/admin_session.json for fast verification
        $sessionData = [
            'token'  => $token,
            'expiry' => $expiryTime,
            'user'   => [
                'id'        => $authenticatedUser['id'] ?? 1,
                'username'  => $authenticatedUser['username'],
                'email'     => $authenticatedUser['email'],
                'full_name' => $authenticatedUser['full_name'],
                'role'      => $authenticatedUser['role']
            ]
        ];
        $sessionDir = __DIR__ . '/../../data';
        if (!is_dir($sessionDir)) {
            @mkdir($sessionDir, 0755, true);
        }
        @file_put_contents($sessionDir . '/admin_session.json', json_encode($sessionData));

        sendResponse(true, 'Login successful. Welcome back!', [
            'token'  => $token,
            'user'   => $sessionData['user'],
            'expiry' => $expiryDate
        ]);
    }

    // 2. VERIFY TOKEN
    if ($action === 'verify') {
        $user = checkAdminAuth();
        sendResponse(true, 'Token is valid', ['user' => $user]);
    }

    // 3. LOGOUT
    if ($action === 'logout') {
        $tokenFile = __DIR__ . '/../../data/admin_session.json';
        if (file_exists($tokenFile)) {
            @unlink($tokenFile);
        }
        sendResponse(true, 'Logged out successfully.');
    }
}

    sendResponse(false, 'Invalid authentication action.', [], 400);
}
