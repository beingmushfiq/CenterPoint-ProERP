<?php

declare(strict_types=1);

// When hit via root public_html for a subdomain or fallback, forward to ProERP public index.php
$possibleTargets = [
    __DIR__ . '/proerp-app/index.php',
    __DIR__ . '/../projects/proerp/public/index.php',
    '/home/devcente/projects/proerp/public/index.php',
];

foreach ($possibleTargets as $target) {
    if (file_exists($target)) {
        require $target;
        exit;
    }
}

http_response_code(503);
$isApi = isset($_SERVER['REQUEST_URI']) && (str_contains($_SERVER['REQUEST_URI'], '/api/') || str_starts_with($_SERVER['REQUEST_URI'], '/api'));
if ($isApi) {
    header('Content-Type: application/json');
    echo json_encode([
        'success' => false,
        'error' => [
            'code' => 'ROUTING_ERROR',
            'message' => 'ProERP public entry point not found in public_html.',
        ],
    ]);
} else {
    echo '<!DOCTYPE html><html><head><title>Service Unavailable</title></head><body><h1>Service Unavailable</h1><p>ProERP public application entry point is not linked.</p></body></html>';
}
