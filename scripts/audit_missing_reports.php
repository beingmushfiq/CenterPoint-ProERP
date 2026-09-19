<?php

$seeder = file_get_contents(__DIR__ . '/../backend/database/seeders/ReportDefinitionsTableSeeder.php');
preg_match_all("/'code'\s*=>\s*'([^']+)'/", $seeder, $m);
$allCodes = array_unique($m[1]);

$actionFile = file_get_contents(__DIR__ . '/../backend/app/Modules/Reports/Actions/RunReportQueryAction.php');
preg_match_all("/'([^']+)'\s*=>\s*([A-Za-z0-9_]+)::class/", $actionFile, $m2);
$mappedCodes = $m2[1];

echo "Total in seeder: " . count($allCodes) . "\n";
echo "Mapped in action: " . count($mappedCodes) . "\n";

$missing = array_diff($allCodes, $mappedCodes);
echo "Missing count: " . count($missing) . "\n\n";

$extra = array_diff($mappedCodes, $allCodes);
echo "Extra mapped in action not in seeder: " . implode(', ', $extra) . "\n\n";

// Group missing by module from seeder
preg_match_all("/'code'\s*=>\s*'([^']+)'.*?'module'\s*=>\s*'([^']+)'/s", $seeder, $m3);
$moduleByCode = array_combine($m3[1], $m3[2]);

$missingByModule = [];
foreach ($missing as $code) {
    $mod = $moduleByCode[$code] ?? 'unknown';
    $missingByModule[$mod][] = $code;
}

foreach ($missingByModule as $mod => $codes) {
    echo "=== MODULE: $mod (" . count($codes) . ") ===\n";
    foreach ($codes as $c) {
        echo "  - $c\n";
    }
}
