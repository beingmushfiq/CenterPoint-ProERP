<?php

declare(strict_types=1);

use Illuminate\Foundation\Application;
use Illuminate\Http\Request;

define('LARAVEL_START', microtime(true));

// Path to non-public Laravel backend application
$backendPath = __DIR__.'/../backend';

// Determine if the application is in maintenance mode...
if (file_exists($maintenance = $backendPath.'/storage/framework/maintenance.php')) {
    require $maintenance;
}

// Register the Composer autoloader...
if (!file_exists($autoloader = $backendPath.'/vendor/autoload.php')) {
    http_response_code(503);
    echo '<!DOCTYPE html><html><head><title>System Updating</title><style>body{font-family:system-ui,-apple-system,sans-serif;padding:40px;text-align:center;background:#0f172a;color:#f8fafc;}h1{font-size:24px;margin-bottom:12px;}p{color:#94a3b8;}</style></head><body><h1>System Initialization</h1><p>Backend dependencies are being installed. Please run composer install or deployment script.</p></body></html>';
    exit(1);
}
require $autoloader;

// Bootstrap Laravel and handle the request...
/** @var Application $app */
$app = require_once $backendPath.'/bootstrap/app.php';

$app->handleRequest(Request::capture());
