<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Modules\Sales\Models\CrmLead;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

final class CrmLeadsTableSeeder extends Seeder
{
    public function run(): void
    {
        $leads = [
            [
                'lead_number' => 'LD-260820-0001',
                'name' => 'Rahim Chowdhury',
                'company_name' => 'Bengal Textile Mills Ltd',
                'email' => 'rahim@bengaltextile.com',
                'phone' => '+8801711223344',
                'source' => 'storefront',
                'stage' => 'proposal',
                'is_fake' => false,
                'validation_notes' => null,
                'assigned_to' => 5,
                'expected_value' => '450000.0000',
                'expected_close_date' => '2026-09-15',
                'notes' => 'Inquiring for bulk customized poly packaging and industrial rolls (10,000 units/mo).',
            ],
            [
                'lead_number' => 'LD-260822-0002',
                'name' => 'Anika Tabassum',
                'company_name' => 'Urban Retailers Hub',
                'email' => 'anika@urbanretail.bd',
                'phone' => '+8801822334455',
                'source' => 'referral',
                'stage' => 'qualified',
                'is_fake' => false,
                'validation_notes' => null,
                'assigned_to' => 5,
                'expected_value' => '185000.0000',
                'expected_close_date' => '2026-09-08',
                'notes' => 'Looking to switch suppliers for corrugated master cartons.',
            ],
            [
                'lead_number' => 'LD-260815-0003',
                'name' => 'Mahmudul Hasan',
                'company_name' => 'Apex Footwear Supply Chain',
                'email' => 'm.hasan@apexsupplies.com',
                'phone' => '+8801933445566',
                'source' => 'website',
                'stage' => 'won',
                'is_fake' => false,
                'validation_notes' => null,
                'assigned_to' => 5,
                'expected_value' => '820000.0000',
                'expected_close_date' => '2026-09-02',
                'converted_at' => '2026-09-02 10:00:00',
                'notes' => 'Price negotiation on 5-ply export grade boxes completed. Contract signed.',
            ],
            [
                'lead_number' => 'LD-260829-0004',
                'name' => 'Zubair Al-Mamun',
                'company_name' => 'Dhaka Superstore Mart',
                'email' => 'zubair@dhakasuper.com',
                'phone' => '+8801644556677',
                'source' => 'cold_outreach',
                'stage' => 'fake',
                'is_fake' => true,
                'validation_notes' => 'Phone switched off on 3 attempts; no trade license match.',
                'assigned_to' => null,
                'expected_value' => '95000.0000',
                'expected_close_date' => '2026-09-20',
                'notes' => 'Phone number unreachable, invalid company registered address.',
            ],
        ];

        foreach ($leads as $item) {
            CrmLead::firstOrCreate(
                [
                    'tenant_id' => 1,
                    'lead_number' => $item['lead_number'],
                ],
                array_merge($item, [
                    'tenant_id' => 1,
                    'uuid' => (string) Str::uuid(),
                    'created_by' => 1,
                ])
            );
        }
    }
}
