<?php

declare(strict_types=1);

namespace App\Modules\Reports\Contracts;

interface ReportQueryInterface
{
    /**
     * Get available report column definitions.
     *
     * @return array<string, array{label: string, type: string, sortable?: bool}>
     */
    public function columns(): array;

    /**
     * Execute paginated report dataset.
     *
     * @param  array<string, mixed>  $filters
     * @return array{data: array<int, array<string, mixed>>, total: int, current_page: int, per_page: int}
     */
    public function query(array $filters, int $page = 1, int $perPage = 25): array;

    /**
     * Calculate server-side totals and summary metrics.
     *
     * @param  array<string, mixed>  $filters
     * @return array<string, mixed>
     */
    public function summary(array $filters): array;
}
