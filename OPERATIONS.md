# Production ERP & Storefront — Operations & Scheduler Guide

This guide details background scheduled tasks, queue workers, maintenance routines, and health checks required to operate the platform reliably in production.

---

## ⏰ Cron Jobs & Task Scheduler

Laravel's task scheduler handles periodic housekeeping, metering, idempotency cleanup, and subscription lifecycle management. The master cron entry must execute every minute on the server:

```cron
* * * * * /opt/cpanel/ea-php84/root/usr/bin/php /home/devcente/projects/proerp/backend/artisan schedule:run >> /home/devcente/logs/proerp-schedule.log 2>&1
```

### Scheduled Command Registry

| Job Name | Schedule | Overlapping? | Purpose & Impact |
|---|---|---|---|
| `idempotency:purge-expired` | Hourly (`0 * * * *`) | `withoutOverlapping()` | Purges expired idempotency keys from the cache/database table to prevent memory growth and table bloat. |
| `tenants:sync-usage` | Hourly (`0 * * * *`) | `withoutOverlapping()` | Aggregates transactional volume, active employees, storage usage, and API throughput against tenant subscription tier quotas. |
| `subscriptions:process-lifecycle` | Daily at 00:05 | `withoutOverlapping()` | Evaluates trial expiry, transitions past-due invoices, and updates tenant subscription statuses (`trial` -> `active` / `past_due` / `expired`). Triggers warning notifications before tenant suspension. |
| `backup:database` | Daily at 02:00 | Allowed | Creates an encrypted mysqldump snapshot stored under `storage/app/backups/` and rotates backups older than 30 days. |

---

## ⚡ Background Queue Workers

The platform dispatches asynchronous background tasks (such as tenant webhook deliveries, report generation exports, and transactional alert notifications) via the Laravel Queue system.

### cPanel / Shared Hosting Worker Pattern
Because continuous daemon processes like `supervisord` are restricted on shared hosting, run the worker via a 1-minute cron with `--stop-when-empty`:

```cron
* * * * * /opt/cpanel/ea-php84/root/usr/bin/php /home/devcente/projects/proerp/backend/artisan queue:work --stop-when-empty --max-time=55 >> /home/devcente/logs/proerp-queue.log 2>&1
```

### VPS / Dedicated Server Worker Pattern (Supervisor)
When running on an isolated VPS or Kubernetes node, use Supervisor to ensure 2-4 concurrent daemon workers:

```ini
[program:proerp-worker]
process_name=%(program_name)s_%(process_num)02d
command=php /var/www/proerp/backend/artisan queue:work --sleep=3 --tries=3 --max-time=3600
autostart=true
autorestart=true
user=www-data
numprocs=2
redirect_stderr=true
stdout_logfile=/var/www/proerp/backend/storage/logs/worker.log
stopwaitsecs=3600
```

---

## 🩺 System Health & Monitoring Endpoints

- **Liveness probe:** `GET /up` (HTTP 200: application booted, database reachable)
- **Tenant Manifest:** `GET /api/v1/tenant/manifest` (verifies tenant isolation and module feature flags)
- **Application Info:** `php artisan about` (displays PHP, environment, cache drivers, and route bindings)

---

## 🧹 Manual Maintenance Runbook

1. **Clear and Rebuild All Production Caches:**
   ```bash
   php artisan config:cache
   php artisan route:cache
   php artisan view:cache
   php artisan event:cache
   ```

2. **Restart Queue Workers:**
   ```bash
   php artisan queue:restart
   ```

3. **Check Failed Queue Jobs:**
   ```bash
   php artisan queue:failed
   php artisan queue:retry all
   ```
