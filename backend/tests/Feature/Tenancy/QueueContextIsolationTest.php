<?php

declare(strict_types=1);

namespace Tests\Feature\Tenancy;

use App\Core\Tenancy\Concerns\TenantAwareJob;
use App\Core\Tenancy\TenantContext;
use App\Models\Tenant;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;

class QueueContextIsolationTest extends TestCase
{
    use RefreshDatabase;

    private Tenant $tenant;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(DatabaseSeeder::class);

        $this->tenant = Tenant::firstOrFail();
    }

    public function test_tenant_context_is_flushed_on_queue_looping(): void
    {
        TenantContext::bind($this->tenant->toArray());
        $this->assertTrue(TenantContext::isBound());

        // Trigger the registered Queue::looping event
        $events = app('events');
        $events->dispatch(new \Illuminate\Queue\Events\JobProcessing('database', new \Illuminate\Queue\Jobs\SyncJob(app(), 'test', 'default', 'test')));

        // Or direct looping event
        $events->dispatch('Illuminate\Queue\Events\Looping');

        $this->assertFalse(TenantContext::isBound());
    }

    public function test_tenant_aware_job_binds_and_flushes_context_correctly(): void
    {
        TenantContext::flush();
        $this->assertFalse(TenantContext::isBound());

        $job = new class
        {
            use TenantAwareJob;

            public bool $executedWithContext = false;

            public function handle(): void
            {
                $this->executedWithContext = TenantContext::isBound()
                    && TenantContext::current()->tenantId() === $this->tenantId;
            }
        };

        $job->initializeTenantContext($this->tenant->id);
        $this->assertSame($this->tenant->id, $job->tenantId);

        // Execute through middleware pipeline
        $middleware = $job->middleware();
        $this->assertCount(1, $middleware);

        $nextCalled = false;
        $middleware[0]->handle($job, function ($j) use (&$nextCalled) {
            $nextCalled = true;
            $j->handle();
            $this->assertTrue(TenantContext::isBound());

            return true;
        });

        $this->assertTrue($nextCalled);
        $this->assertTrue($job->executedWithContext);

        // Verify context was flushed after middleware finished
        $this->assertFalse(TenantContext::isBound());
    }
}
