<?php

declare(strict_types=1);

ini_set('display_errors', '1');
ini_set('display_startup_errors', '1');
error_reporting(E_ALL);

register_shutdown_function(function () {
    $err = error_get_last();
    if ($err && in_array($err['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR])) {
        http_response_code(500);
        header('Content-Type: application/json');
        echo json_encode(['fatal_error' => $err], JSON_PRETTY_PRINT);
    }
});

use Illuminate\Foundation\Application;
use Illuminate\Http\Request;

if (!defined('LARAVEL_START')) {
    define('LARAVEL_START', microtime(true));
}

// =============================================================================
// Instant SPA Routing Handler
// When requests for frontend client routes (e.g. /login, /dashboard, /reports,
// /platform, etc.) reach index.php on LiteSpeed / Apache, immediately serve
// index.html so the client-side React Router handles the route.
// =============================================================================
$requestUri = $_SERVER['REQUEST_URI'] ?? '/';
$requestPath = parse_url($requestUri, PHP_URL_PATH) ?: '/';
$requestMethod = $_SERVER['REQUEST_METHOD'] ?? 'GET';

$isApiOrSystemRoute = str_starts_with($requestPath, '/api/')
    || $requestPath === '/api'
    || str_starts_with($requestPath, '/sanctum/')
    || in_array($requestPath, ['/up', '/healthz', '/readyz', '/robots.txt', '/sitemap.xml', '/manifest.json'], true)
    || (bool) preg_match('#^/store/[^/]+/(manifest\.json|sitemap.*\.xml|robots\.txt)$#', $requestPath)
    || str_contains($requestPath, 'index.php/api/');

$isStaticFile = (bool) preg_match('/\.(js|css|png|jpe?g|gif|svg|ico|webp|woff2?|ttf|eot|json|map)$/i', $requestPath);

if (!$isApiOrSystemRoute && !$isStaticFile && in_array($requestMethod, ['GET', 'HEAD'], true)) {
    $spaIndexFile = __DIR__ . '/index.html';
    if (file_exists($spaIndexFile)) {
        header('Content-Type: text/html; charset=utf-8');
        header('Cache-Control: no-cache, no-store, must-revalidate');
        header('Pragma: no-cache');
        header('Expires: 0');
        if ($requestMethod === 'HEAD') {
            header('Content-Length: ' . (string) filesize($spaIndexFile));
            exit(0);
        }
        readfile($spaIndexFile);
        exit(0);
    }
}

// =============================================================================
// Server Layout (cPanel Multi-Project):
//   Document Root:  /home/devcente/projects/proerp/public/   ← this file lives here
//   Laravel App:    /home/devcente/projects/proerp/backend/  ← one level up
//
// The backend is OUTSIDE the web root — source code, .env, vendor, and all
// application logic are completely inaccessible to the public internet.
// =============================================================================
$possiblePaths = [
    __DIR__ . '/../backend',
    __DIR__ . '/../projects/proerp/backend',
    '/home/devcente/projects/proerp/backend',
    '/home/devcente/repositories/proerp/backend',
    '/home/devcente/backend',
    dirname(__DIR__) . '/backend',
];

$backendPath = null;
foreach ($possiblePaths as $candidate) {
    if (file_exists($candidate . '/bootstrap/app.php')) {
        $backendPath = $candidate;
        break;
    }
}

if (!$backendPath) {
    $backendPath = __DIR__ . '/../backend';
}

// Determine if the application is in maintenance mode...
if (file_exists($maintenance = $backendPath . '/storage/framework/maintenance.php')) {
    require $maintenance;
}

// Register the Composer autoloader...
if (!file_exists($autoloader = $backendPath . '/vendor/autoload.php')) {
    http_response_code(503);
    $isApi = isset($_SERVER['REQUEST_URI']) && (str_contains($_SERVER['REQUEST_URI'], '/api/') || str_starts_with($_SERVER['REQUEST_URI'], '/api'));
    if ($isApi) {
        header('Content-Type: application/json');
        echo json_encode([
            'success' => false,
            'error' => [
                'code' => 'SERVICE_UNAVAILABLE',
                'message' => 'Backend initialization pending. Please complete composer install.',
            ],
        ]);
    } else {
        echo '<!DOCTYPE html><html><head><title>System Updating</title><style>body{font-family:system-ui,-apple-system,sans-serif;padding:40px;text-align:center;background:#0f172a;color:#f8fafc;}h1{font-size:24px;margin-bottom:12px;}p{color:#94a3b8;}</style></head><body><h1>System Initialization</h1><p>Backend dependencies are being installed. Please run <code>composer install</code> or the deployment script.</p></body></html>';
    }
    exit(1);
}
require $autoloader;

// =============================================================================
// Authorization Header Fix
// cPanel / Websuru Apache runs PHP via FastCGI or PHP-FPM. In these modes,
// Apache strips the Authorization header by default, breaking JWT authentication.
// This block restores it from multiple fallback sources before Laravel reads it.
// =============================================================================
if (!isset($_SERVER['HTTP_AUTHORIZATION'])) {
    if (isset($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) {
        $_SERVER['HTTP_AUTHORIZATION'] = $_SERVER['REDIRECT_HTTP_AUTHORIZATION'];
    } elseif (isset($_SERVER['REDIRECT_REDIRECT_HTTP_AUTHORIZATION'])) {
        $_SERVER['HTTP_AUTHORIZATION'] = $_SERVER['REDIRECT_REDIRECT_HTTP_AUTHORIZATION'];
    } elseif (isset($_SERVER['HTTP_X_AUTHORIZATION'])) {
        $_SERVER['HTTP_AUTHORIZATION'] = $_SERVER['HTTP_X_AUTHORIZATION'];
    } elseif (function_exists('apache_request_headers')) {
        $headers = apache_request_headers();
        if (isset($headers['Authorization'])) {
            $_SERVER['HTTP_AUTHORIZATION'] = $headers['Authorization'];
        } elseif (isset($headers['authorization'])) {
            $_SERVER['HTTP_AUTHORIZATION'] = $headers['authorization'];
        } elseif (isset($headers['X-Authorization'])) {
            $_SERVER['HTTP_AUTHORIZATION'] = $headers['X-Authorization'];
        }
    }
}

try {
    // Bootstrap Laravel and handle the request...
    /** @var Application $app */
    $app = require_once $backendPath . '/bootstrap/app.php';

    $app->handleRequest(Request::capture());
} catch (Throwable $e) {
    http_response_code(500);
    header('Content-Type: application/json');
    echo json_encode([
        'success' => false,
        'error' => [
            'code' => 'PHP_EXCEPTION',
            'message' => $e->getMessage(),
            'file' => $e->getFile(),
            'line' => $e->getLine(),
        ],
    ], JSON_PRETTY_PRINT);
    exit(1);
}
