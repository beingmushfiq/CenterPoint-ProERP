<?php

declare(strict_types=1);

use Illuminate\Foundation\Application;
use Illuminate\Http\Request;

define('LARAVEL_START', microtime(true));

// =============================================================================
// Server Layout (cPanel Multi-Project):
//   Document Root:  /home/devcente/projects/proerp/public/   ← this file lives here
//   Laravel App:    /home/devcente/projects/proerp/backend/  ← one level up
//
// The backend is OUTSIDE the web root — source code, .env, vendor, and all
// application logic are completely inaccessible to the public internet.
// =============================================================================
$backendPath = __DIR__ . '/../backend';

// Determine if the application is in maintenance mode...
if (file_exists($maintenance = $backendPath . '/storage/framework/maintenance.php')) {
    require $maintenance;
}

// Register the Composer autoloader...
if (!file_exists($autoloader = $backendPath . '/vendor/autoload.php')) {
    http_response_code(503);
    echo '<!DOCTYPE html><html><head><title>System Updating</title><style>body{font-family:system-ui,-apple-system,sans-serif;padding:40px;text-align:center;background:#0f172a;color:#f8fafc;}h1{font-size:24px;margin-bottom:12px;}p{color:#94a3b8;}</style></head><body><h1>System Initialization</h1><p>Backend dependencies are being installed. Please run <code>composer install</code> or the deployment script.</p></body></html>';
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

// Bootstrap Laravel and handle the request...
/** @var Application $app */
$app = require_once $backendPath . '/bootstrap/app.php';

$app->handleRequest(Request::capture());
