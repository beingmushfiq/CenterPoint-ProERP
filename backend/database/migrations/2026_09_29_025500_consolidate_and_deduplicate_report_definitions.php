<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     * Consolidates 84 reports down to 76 by deactivating 8 redundant/duplicate reports
     * and enriching the canonical merged report definitions.
     */
    public function up(): void
    {
        $retiredCodes = [
            'worker_piece_rate_summary',
            'salesman_profitability',
            'daily_sales',
            'b2c_sales',
            'salesman_leaderboard',
            'delivery_sla_history',
            'converted_leads',
            'lost_leads_analysis',
        ];

        // Deactivate the 8 duplicate reports
        DB::table('report_definitions')
            ->whereIn('code', $retiredCodes)
            ->update([
                'is_active' => false,
                'updated_at' => now(),
            ]);

        // Enrich the canonical merged reports
        DB::table('report_definitions')
            ->where('code', 'worker_production')
            ->update([
                'name' => 'Worker Piece-Rate & Production Log',
                'description' => 'Line operator individual output logs, completed piece units, base pay, and piece bonus accruals.',
                'updated_at' => now(),
            ]);

        DB::table('report_definitions')
            ->where('code', 'salesman_profit_contribution')
            ->update([
                'description' => 'Actual gross margin and profit delivered by each sales agent beyond revenue, factoring product cost and commissions.',
                'updated_at' => now(),
            ]);

        DB::table('report_definitions')
            ->where('code', 'sales_performance')
            ->update([
                'name' => 'Sales Performance & Daily Channel Revenue',
                'description' => 'Omnichannel revenue, daily order volume, gross receipts, discounts, and payment settlement.',
                'updated_at' => now(),
            ]);

        DB::table('report_definitions')
            ->where('code', 'product_sales')
            ->update([
                'description' => 'Best-selling SKUs, online B2C storefront & offline sales velocity, inventory turnover, and revenue per product style.',
                'updated_at' => now(),
            ]);

        DB::table('report_definitions')
            ->where('code', 'salesman_sales')
            ->update([
                'name' => 'Salesman Sales & Leaderboard Ranking',
                'description' => 'Attributed revenue, conversion rate, profit delivered, and ranked leaderboard performance.',
                'updated_at' => now(),
            ]);

        DB::table('report_definitions')
            ->where('code', 'courier_performance')
            ->update([
                'name' => 'Courier Performance & SLA Transit History',
                'description' => 'Courier success rate %, average delivery transit time across zones, and historical SLA performance.',
                'updated_at' => now(),
            ]);

        DB::table('report_definitions')
            ->where('code', 'lead_summary')
            ->update([
                'name' => 'Lead Pipeline & Conversion Summary',
                'description' => 'Total leads, stage funnel, converted deal value, and conversion rates across channels.',
                'updated_at' => now(),
            ]);

        DB::table('report_definitions')
            ->where('code', 'lead_status_distribution')
            ->update([
                'name' => 'Lead Status & Lost Reason Distribution',
                'description' => 'Breakdown of active inquiries across lifecycle stages and loss rejection root cause analysis.',
                'updated_at' => now(),
            ]);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        $retiredCodes = [
            'worker_piece_rate_summary',
            'salesman_profitability',
            'daily_sales',
            'b2c_sales',
            'salesman_leaderboard',
            'delivery_sla_history',
            'converted_leads',
            'lost_leads_analysis',
        ];

        DB::table('report_definitions')
            ->whereIn('code', $retiredCodes)
            ->update([
                'is_active' => true,
                'updated_at' => now(),
            ]);
    }
};
