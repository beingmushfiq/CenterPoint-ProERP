<?php

declare(strict_types=1);

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class PurgeExpiredIdempotencyKeys extends Command
{
    protected $signature = 'idempotency:purge-expired {--dry-run : Only count expired records without deleting}';

    protected $description = 'Purge expired idempotency keys older than their expires_at timestamp';

    public function handle(): int
    {
        $now = now();
        $query = DB::table('idempotency_keys')->where('expires_at', '<=', $now);

        if ($this->option('dry-run')) {
            $count = $query->count();
            $this->info("Dry run: {$count} expired idempotency key(s) identified for deletion.");

            return 0;
        }

        $deleted = $query->delete();
        $this->info("Successfully purged {$deleted} expired idempotency key(s).");

        return 0;
    }
}
