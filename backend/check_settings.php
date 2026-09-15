<?php
require 'vendor/autoload.php';
$app = require 'bootstrap/app.php';
$app->make(\Illuminate\Contracts\Console\Kernel::class)->bootstrap();

$settings = \App\Models\Setting::withoutTenantScope()->take(20)->get();
echo "Found " . $settings->count() . " settings\n";
foreach ($settings as $s) {
    echo "Key: {$s->key}, Scope: {$s->scope}, ValueType: {$s->value_type}\n";
    echo "  Raw value property type: " . gettype($s->value) . "\n";
    echo "  Raw value content: " . json_encode($s->value) . "\n";
    try {
        $typed = $s->getTypedValue();
        echo "  Typed value: " . json_encode($typed) . "\n";
    } catch (\Throwable $e) {
        echo "  ERROR in getTypedValue(): " . $e->getMessage() . "\n";
    }
}
