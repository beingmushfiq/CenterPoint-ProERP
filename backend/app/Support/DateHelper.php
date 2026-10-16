<?php

declare(strict_types=1);

namespace App\Support;

use Carbon\Carbon;
use Carbon\CarbonInterface;
use Throwable;

/**
 * Enterprise Fiscal Calendar and Date Helper.
 * Handles fiscal accounting cycles, ISO-8601 UTC conversions, and date periods.
 */
final class DateHelper
{
    /**
     * Default fiscal year start month (July in Bangladesh/regional standard).
     */
    public const DEFAULT_FISCAL_START_MONTH = 7;

    /**
     * Get the bounds of the fiscal year containing the given date or now.
     *
     * @return array{start: Carbon, end: Carbon, label: string}
     */
    public static function getFiscalYearBounds(?CarbonInterface $date = null, int $startMonth = self::DEFAULT_FISCAL_START_MONTH): array
    {
        $dt = $date !== null ? Carbon::instance($date) : Carbon::now();
        $year = $dt->year;

        if ($dt->month < $startMonth) {
            $startDate = Carbon::createFromDate($year - 1, $startMonth, 1)->startOfDay();
            $endDate = Carbon::createFromDate($year, $startMonth, 1)->subDay()->endOfDay();
            $label = sprintf('FY %d-%d', $year - 1, $year);
        } else {
            $startDate = Carbon::createFromDate($year, $startMonth, 1)->startOfDay();
            $endDate = Carbon::createFromDate($year + 1, $startMonth, 1)->subDay()->endOfDay();
            $label = sprintf('FY %d-%d', $year, $year + 1);
        }

        return [
            'start' => $startDate,
            'end' => $endDate,
            'label' => $label,
        ];
    }

    /**
     * Safely format any date input into a strict ISO-8601 UTC string.
     */
    public static function toIsoUtc(CarbonInterface|string|null $date): ?string
    {
        if ($date === null) {
            return null;
        }

        if ($date instanceof CarbonInterface) {
            return $date->copy()->setTimezone('UTC')->toIso8601ZuluString();
        }

        try {
            return Carbon::parse($date)->setTimezone('UTC')->toIso8601ZuluString();
        } catch (Throwable) {
            return null;
        }
    }

    /**
     * Convert any date string to standard database 'Y-m-d' format.
     */
    public static function toDateString(CarbonInterface|string|null $date): ?string
    {
        if ($date === null) {
            return null;
        }

        if ($date instanceof CarbonInterface) {
            return $date->toDateString();
        }

        try {
            return Carbon::parse($date)->toDateString();
        } catch (Throwable) {
            return null;
        }
    }
}
