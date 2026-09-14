<?php

declare(strict_types=1);

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function (): void {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Schedule::command('idempotency:purge-expired')->hourly()->withoutOverlapping();
Schedule::command('subscriptions:process-lifecycle')->dailyAt('00:05')->withoutOverlapping();
Schedule::command('backup:database')->dailyAt('02:00');
