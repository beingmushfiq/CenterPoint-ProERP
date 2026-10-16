<?php

declare(strict_types=1);

return [

    /*
    |--------------------------------------------------------------------------
    | Cross-Origin Resource Sharing (CORS) Configuration
    |--------------------------------------------------------------------------
    |
    | Here you may configure your settings for cross-origin resource sharing
    | or "CORS". This determines what cross-origin operations may execute
    | in web browsers.
    |
    */

    'paths' => ['api/*', 'sanctum/csrf-cookie', 'up'],

    'allowed_methods' => ['*'],

    'allowed_origins' => array_filter(
        array_map('trim', explode(',', (string) env('CORS_ALLOWED_ORIGINS', 'https://proerp.devcenterpoint.com')))
    ),

    'allowed_origins_patterns' => [
        '#^https?://([a-z0-9\-]+\.)?devcenterpoint\.com(:\d+)?$#i',
        '#^https?://([a-z0-9\-]+\.)?localhost(:\d+)?$#i',
        '#^https?://127\.0\.0\.1(:\d+)?$#i',
    ],

    'allowed_headers' => ['*'],

    'exposed_headers' => [
        'X-Correlation-Id',
        'X-Total-Count',
        'Content-Disposition',
    ],

    'max_age' => 86400,

    'supports_credentials' => true,

];
