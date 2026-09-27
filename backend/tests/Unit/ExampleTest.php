<?php

declare(strict_types=1);

namespace Tests\Unit;

use PHPUnit\Framework\TestCase;

class ExampleTest extends TestCase
{
    /**
     * The suite must not silently run on an interpreter the application does
     * not support: a CI matrix or a developer machine below the floor produces
     * failures whose real cause is the runtime, not the code.
     *
     * The floor is read out of `composer.json` rather than written here as a
     * literal. A hardcoded number is free to disagree with the declaration —
     * which is exactly the drift this test exists to catch.
     */
    public function test_the_runtime_satisfies_the_declared_php_floor(): void
    {
        $manifest = file_get_contents(__DIR__.'/../../composer.json');
        $this->assertIsString($manifest, 'composer.json could not be read.');

        $decoded = json_decode($manifest, true, 512, JSON_THROW_ON_ERROR);
        $this->assertIsArray($decoded);
        $this->assertArrayHasKey('require', $decoded);
        $this->assertIsArray($decoded['require']);
        $this->assertArrayHasKey('php', $decoded['require']);

        $constraint = $decoded['require']['php'];
        $this->assertIsString($constraint);

        // Support `^8.5` or `^8.4|^8.5` constraints
        $this->assertMatchesRegularExpression(
            '/^\^\d+\.\d+(\|\^\d+\.\d+)?$/',
            $constraint,
            "Unexpected PHP constraint {$constraint}; update this test alongside it."
        );

        $firstConstraint = explode('|', $constraint)[0];
        $floor = ltrim($firstConstraint, '^');

        $this->assertTrue(
            version_compare(PHP_VERSION, $floor.'.0', '>='),
            "composer.json requires PHP {$constraint}; running ".PHP_VERSION.'.'
        );
    }
}
