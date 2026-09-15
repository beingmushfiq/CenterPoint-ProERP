<?php
/**
 * DevCenterPoint ProERP — Automated Webhook Deployment Endpoint
 * 
 * Set up in GitHub:
 *   Repository > Settings > Webhooks > Add webhook
 *   Payload URL: https://proerp.devcenterpoint.com/deploy-webhook.php
 *   Content type: application/json
 *   Secret: (Must match DEPLOY_SECRET in .env or below)
 */

declare(strict_types=1);

// Prevent caching
header('Content-Type: application/json');
header('Cache-Control: no-cache, must-revalidate');

$homeDir = getenv('HOME') ?: '/home/devcente';
$logFile = $homeDir . '/logs/webhook-deploy.log';
$scriptPath = $homeDir . '/scripts/auto-deploy.sh';

// 1. Verify Secret Token (either header or query param)
$secret = getenv('DEPLOY_SECRET') ?: 'proerp-deploy-secret-key-2026';
$providedSecret = $_SERVER['HTTP_X_HUB_SIGNATURE_256'] ?? $_GET['token'] ?? null;

if (!$providedSecret) {
    http_response_code(401);
    echo json_encode(['status' => 'error', 'message' => 'Unauthorized: Missing deploy token or signature.']);
    exit;
}

// Check GET token or GitHub HMAC signature
$authorized = false;
if (isset($_GET['token']) && hash_equals($secret, (string)$_GET['token'])) {
    $authorized = true;
} elseif (isset($_SERVER['HTTP_X_HUB_SIGNATURE_256'])) {
    $payload = file_get_contents('php://input');
    $expectedSignature = 'sha256=' . hash_hmac('sha256', $payload, $secret);
    if (hash_equals($expectedSignature, $_SERVER['HTTP_X_HUB_SIGNATURE_256'])) {
        $authorized = true;
    }
}

if (!$authorized) {
    http_response_code(403);
    echo json_encode(['status' => 'error', 'message' => 'Forbidden: Invalid deploy token or signature.']);
    exit;
}

// 2. Ensure log directory exists
if (!is_dir($homeDir . '/logs')) {
    @mkdir($homeDir . '/logs', 0755, true);
}

// 3. Trigger deployment script in the background
$command = sprintf(
    '/bin/bash %s >> %s 2>&1 &',
    escapeshellarg($scriptPath),
    escapeshellarg($logFile)
);

exec($command, $output, $returnCode);

echo json_encode([
    'status' => 'success',
    'message' => 'Automated deployment triggered successfully in the background.',
    'script' => $scriptPath,
    'log_file' => $logFile,
    'timestamp' => date('Y-m-d H:i:s'),
]);
