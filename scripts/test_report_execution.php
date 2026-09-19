<?php

declare(strict_types=1);

require __DIR__ . '/../backend/vendor/autoload.php';
$app = require_once __DIR__ . '/../backend/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Modules\Reports\Actions\RunReportQueryAction;
use App\Modules\Reports\Models\ReportDefinition;

$action = new RunReportQueryAction();

$definitions = ReportDefinition::orderBy('module')->orderBy('code')->get();
echo "Testing ALL " . $definitions->count() . " report definitions in database...\n\n";

$passed = 0;
$failed = 0;
$failures = [];

foreach ($definitions as $def) {
    try {
        $result = $action->execute($def->code, [], 1, 5);
        $colCount = count($result['columns'] ?? []);
        $rowCount = count($result['data'] ?? []);
        $total = $result['pagination']['total'] ?? 0;
        echo "[OK] ({$def->module}) {$def->code}: {$colCount} cols, {$rowCount} rows returned (total: {$total})\n";
        $passed++;
    } catch (\Throwable $e) {
        echo "[ERR] ({$def->module}) {$def->code}: " . $e->getMessage() . "\n";
        $failed++;
        $failures[] = "{$def->code}: " . $e->getMessage();
    }
}

echo "\n============================================\n";
echo "REPORT EXECUTION AUDIT: {$passed} PASSED, {$failed} FAILED\n";
echo "============================================\n";

if ($failed > 0) {
    echo "Failures:\n";
    foreach ($failures as $f) {
        echo " - {$f}\n";
    }
    exit(1);
}
