<?php

declare(strict_types=1);

namespace Tests\Feature\Production;

use Illuminate\Support\Facades\File;
use Tests\TestCase;

class DatabaseBackupTest extends TestCase
{
    public function test_database_backup_command_creates_valid_manifest(): void
    {
        $backupDir = storage_path('app/backups');
        if (! File::exists($backupDir)) {
            File::makeDirectory($backupDir, 0755, true);
        }

        $exitCode = $this->artisan('backup:database', ['--retention' => 30]);

        $exitCode->assertExitCode(0);

        $this->assertTrue(File::exists($backupDir));

        $files = File::files($backupDir);
        $this->assertNotEmpty($files);

        usort($files, fn ($a, $b) => $b->getMTime() <=> $a->getMTime());

        $content = json_decode(File::get($files[0]->getPathname()), true);
        $this->assertIsArray($content);
        $this->assertArrayHasKey('status', $content);
        $this->assertEquals('verified', $content['status']);
        $this->assertArrayHasKey('tables_count', $content);
    }
}
