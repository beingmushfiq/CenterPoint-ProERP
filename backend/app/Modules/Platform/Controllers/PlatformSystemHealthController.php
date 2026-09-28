<?php

declare(strict_types=1);

namespace App\Modules\Platform\Controllers;

use App\Http\Controllers\Controller;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Throwable;

class PlatformSystemHealthController extends Controller
{
    /**
     * Run real-time diagnostics on database, storage, cache, queue, and background services.
     */
    public function index(Request $request): JsonResponse
    {
        $checks = [];
        $isDegraded = false;

        // 1. Database Ping & Latency
        $dbStart = microtime(true);
        try {
            DB::select('SELECT 1');
            $dbLatency = round((microtime(true) - $dbStart) * 1000, 2);
            $checks['database'] = [
                'status' => 'healthy',
                'latency_ms' => $dbLatency,
                'driver' => config('database.default'),
            ];
        } catch (Throwable $e) {
            $isDegraded = true;
            $checks['database'] = [
                'status' => 'critical',
                'error' => $e->getMessage(),
            ];
        }

        // 2. Storage Writable Check
        $storageStart = microtime(true);
        try {
            $testFile = 'health_check_'.time().'.tmp';
            Storage::disk('local')->put($testFile, 'ok');
            Storage::disk('local')->delete($testFile);
            $storageLatency = round((microtime(true) - $storageStart) * 1000, 2);
            $checks['storage'] = [
                'status' => 'healthy',
                'latency_ms' => $storageLatency,
                'disk' => 'local',
            ];
        } catch (Throwable $e) {
            $isDegraded = true;
            $checks['storage'] = [
                'status' => 'critical',
                'error' => $e->getMessage(),
            ];
        }

        // 3. Cache Ping
        $cacheStart = microtime(true);
        try {
            $cacheKey = 'platform_health_ping_'.time();
            Cache::put($cacheKey, 'ok', 10);
            $val = Cache::get($cacheKey);
            Cache::forget($cacheKey);
            $cacheLatency = round((microtime(true) - $cacheStart) * 1000, 2);
            $checks['cache'] = [
                'status' => $val === 'ok' ? 'healthy' : 'degraded',
                'latency_ms' => $cacheLatency,
                'store' => config('cache.default'),
            ];
        } catch (Throwable $e) {
            $isDegraded = true;
            $checks['cache'] = [
                'status' => 'degraded',
                'error' => $e->getMessage(),
            ];
        }

        // 4. Queue / Jobs Health
        try {
            $queuedCount = DB::table('jobs')->count();
            $failedCount = DB::table('failed_jobs')->count();

            $checks['queue'] = [
                'status' => $failedCount > 10 ? 'degraded' : 'healthy',
                'queued_jobs' => $queuedCount,
                'failed_jobs' => $failedCount,
                'connection' => config('queue.default'),
            ];
        } catch (Throwable $e) {
            $checks['queue'] = [
                'status' => 'unknown',
                'error' => $e->getMessage(),
            ];
        }

        // 5. Integrations Config Health
        $checks['integrations'] = [
            'mail' => [
                'configured' => config('mail.default') !== null,
                'driver' => config('mail.default', 'log'),
            ],
            'courier_steadfast' => [
                'configured' => ! empty(config('services.steadfast.api_key')),
            ],
            'courier_pathao' => [
                'configured' => ! empty(config('services.pathao.client_id')),
            ],
            'courier_redx' => [
                'configured' => ! empty(config('services.redx.token')),
            ],
        ];

        // Overall status
        $overallStatus = $isDegraded ? 'degraded' : 'healthy';

        // Server telemetry
        $serverInfo = [
            'php_version' => PHP_VERSION,
            'laravel_version' => app()->version(),
            'environment' => app()->environment(),
            'server_time' => Carbon::now()->toIso8601String(),
            'memory_usage_mb' => round(memory_get_usage(true) / 1024 / 1024, 2),
            'memory_peak_mb' => round(memory_get_peak_usage(true) / 1024 / 1024, 2),
        ];

        return response()->json([
            'success' => true,
            'status' => $overallStatus,
            'checks' => $checks,
            'server' => $serverInfo,
            'meta' => [
                'correlation_id' => (string) $request->header('X-Correlation-Id', ''),
                'timestamp' => Carbon::now()->toIso8601String(),
            ],
        ]);
    }
}
