<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Modules\Documents\Models\DocumentTemplate;
use App\Modules\Documents\Models\DocumentTemplateVersion;
use App\Modules\Documents\Models\PaperSize;
use App\Modules\Documents\Models\PrintProfile;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class DocumentTemplatesSeeder extends Seeder
{
    public function run(): void
    {
        // 1. Seed Built-In Global Paper Sizes (tenant_id = null)
        $paperSizes = [
            ['code' => 'a4_portrait',     'name' => 'ISO A4 Portrait (210 × 297 mm)',      'width' => 210.0, 'height' => 297.0, 'orientation' => 'portrait',  'unit' => 'mm', 'top' => 12.0, 'bottom' => 12.0, 'left' => 15.0, 'right' => 15.0],
            ['code' => 'a4_landscape',    'name' => 'ISO A4 Landscape (297 × 210 mm)',     'width' => 297.0, 'height' => 210.0, 'orientation' => 'landscape', 'unit' => 'mm', 'top' => 10.0, 'bottom' => 10.0, 'left' => 12.0, 'right' => 12.0],
            ['code' => 'a5_portrait',     'name' => 'ISO A5 Portrait (148 × 210 mm)',      'width' => 148.0, 'height' => 210.0, 'orientation' => 'portrait',  'unit' => 'mm', 'top' => 8.0,  'bottom' => 8.0,  'left' => 10.0, 'right' => 10.0],
            ['code' => 'a3_landscape',    'name' => 'ISO A3 Wide Ledger (420 × 297 mm)',   'width' => 420.0, 'height' => 297.0, 'orientation' => 'landscape', 'unit' => 'mm', 'top' => 12.0, 'bottom' => 12.0, 'left' => 15.0, 'right' => 15.0],
            ['code' => 'letter_portrait', 'name' => 'US Letter (8.5 × 11 in)',             'width' => 215.9, 'height' => 279.4, 'orientation' => 'portrait',  'unit' => 'inch', 'top' => 12.7, 'bottom' => 12.7, 'left' => 12.7, 'right' => 12.7],
            ['code' => 'thermal_80',      'name' => '80mm POS Thermal Roll',               'width' => 80.0,  'height' => null,  'orientation' => 'portrait',  'unit' => 'mm', 'top' => 2.0,  'bottom' => 2.0,  'left' => 3.0,  'right' => 3.0],
            ['code' => 'thermal_58',      'name' => '58mm Compact POS Roll',               'width' => 58.0,  'height' => null,  'orientation' => 'portrait',  'unit' => 'mm', 'top' => 2.0,  'bottom' => 2.0,  'left' => 2.0,  'right' => 2.0],
            ['code' => 'label_35x25',     'name' => '35 × 25 mm Barcode Label',            'width' => 35.0,  'height' => 25.0,  'orientation' => 'portrait',  'unit' => 'mm', 'top' => 1.0,  'bottom' => 1.0,  'left' => 1.0,  'right' => 1.0],
            ['code' => 'label_50x35',     'name' => '50 × 35 mm Product Price Label',      'width' => 50.0,  'height' => 35.0,  'orientation' => 'portrait',  'unit' => 'mm', 'top' => 1.5,  'bottom' => 1.5,  'left' => 1.5,  'right' => 1.5],
        ];

        foreach ($paperSizes as $ps) {
            PaperSize::updateOrCreate(
                ['code' => $ps['code'], 'tenant_id' => null],
                [
                    'uuid' => (string) Str::uuid(),
                    'name' => $ps['name'],
                    'width_mm' => $ps['width'],
                    'height_mm' => $ps['height'],
                    'unit' => $ps['unit'],
                    'orientation_default' => $ps['orientation'],
                    'margin_top_mm' => $ps['top'],
                    'margin_bottom_mm' => $ps['bottom'],
                    'margin_left_mm' => $ps['left'],
                    'margin_right_mm' => $ps['right'],
                    'is_builtin' => true,
                    'is_active' => true,
                ]
            );
        }

        // 2. Seed Default Templates and Print Profiles for existing tenants
        $tenants = DB::table('tenants')->get();
        $a4Portrait = PaperSize::where('code', 'a4_portrait')->first();
        $thermal80 = PaperSize::where('code', 'thermal_80')->first();
        $label50x35 = PaperSize::where('code', 'label_50x35')->first();

        foreach ($tenants as $tenant) {
            // Seed standard print profiles
            $pA4 = PrintProfile::updateOrCreate(
                ['tenant_id' => $tenant->id, 'name' => 'Standard A4 Laser/Inkjet'],
                [
                    'uuid' => (string) Str::uuid(),
                    'paper_size_id' => $a4Portrait?->id,
                    'orientation' => 'portrait',
                    'margin_top_mm' => 12.0,
                    'margin_bottom_mm' => 12.0,
                    'margin_left_mm' => 15.0,
                    'margin_right_mm' => 15.0,
                    'scale' => 1.0,
                    'copies' => 1,
                    'is_printer_friendly' => true,
                    'is_default' => true,
                    'is_active' => true,
                ]
            );

            $pThermal = PrintProfile::updateOrCreate(
                ['tenant_id' => $tenant->id, 'name' => 'POS 80mm Counter Thermal'],
                [
                    'uuid' => (string) Str::uuid(),
                    'paper_size_id' => $thermal80?->id,
                    'orientation' => 'portrait',
                    'margin_top_mm' => 2.0,
                    'margin_bottom_mm' => 2.0,
                    'margin_left_mm' => 3.0,
                    'margin_right_mm' => 3.0,
                    'scale' => 1.0,
                    'copies' => 1,
                    'is_printer_friendly' => true,
                    'is_default' => false,
                    'is_active' => true,
                ]
            );

            $pLabel = PrintProfile::updateOrCreate(
                ['tenant_id' => $tenant->id, 'name' => '50x35mm Barcode Thermal Roll'],
                [
                    'uuid' => (string) Str::uuid(),
                    'paper_size_id' => $label50x35?->id,
                    'orientation' => 'portrait',
                    'margin_top_mm' => 1.5,
                    'margin_bottom_mm' => 1.5,
                    'margin_left_mm' => 1.5,
                    'margin_right_mm' => 1.5,
                    'scale' => 1.0,
                    'copies' => 1,
                    'is_printer_friendly' => true,
                    'is_default' => false,
                    'is_active' => true,
                ]
            );

            // Seed standard document templates
            $defaultTemplates = [
                [
                    'name' => 'Standard Commercial VAT Invoice',
                    'document_type' => 'sales_invoice',
                    'paper_size_id' => $a4Portrait?->id,
                    'profile_id' => $pA4->id,
                    'config' => [
                        'showLogo' => true,
                        'showCompanyTax' => true,
                        'showCustomerTax' => true,
                        'showBatchNumber' => true,
                        'showSku' => true,
                        'showDiscount' => true,
                        'showVat' => true,
                        'showAmountInWords' => true,
                        'showTerms' => true,
                        'showSignatures' => true,
                        'showQrCode' => true,
                        'primaryColor' => '#0f172a',
                    ],
                ],
                [
                    'name' => 'Standard Goods Delivery Challan',
                    'document_type' => 'delivery_challan',
                    'paper_size_id' => $a4Portrait?->id,
                    'profile_id' => $pA4->id,
                    'config' => [
                        'showLogo' => true,
                        'showVehicleInfo' => true,
                        'showDriverInfo' => true,
                        'showPackageCount' => true,
                        'showSignatures' => true,
                        'primaryColor' => '#0f172a',
                    ],
                ],
                [
                    'name' => 'Standard Purchase Order Voucher',
                    'document_type' => 'purchase_order',
                    'paper_size_id' => $a4Portrait?->id,
                    'profile_id' => $pA4->id,
                    'config' => [
                        'showLogo' => true,
                        'showVendorTax' => true,
                        'showExpectedDate' => true,
                        'showSignatures' => true,
                        'primaryColor' => '#0f172a',
                    ],
                ],
                [
                    'name' => 'Official Money Collection Receipt',
                    'document_type' => 'payment_receipt',
                    'paper_size_id' => $a4Portrait?->id,
                    'profile_id' => $pA4->id,
                    'config' => [
                        'showLogo' => true,
                        'showPaymentMethod' => true,
                        'showTransactionRef' => true,
                        'showAmountInWords' => true,
                        'showSignatures' => true,
                        'primaryColor' => '#0f172a',
                    ],
                ],
                [
                    'name' => '80mm POS Thermal Receipt Slip',
                    'document_type' => 'pos_receipt_80mm',
                    'paper_size_id' => $thermal80?->id,
                    'profile_id' => $pThermal->id,
                    'config' => [
                        'showLogo' => true,
                        'showCashierName' => true,
                        'showBarcode' => true,
                        'showTaxSummary' => true,
                        'showChangeDue' => true,
                        'footerGreeting' => 'Thank you for shopping with us!',
                    ],
                ],
                [
                    'name' => '50x35mm Retail Barcode Sticker',
                    'document_type' => 'barcode_label',
                    'paper_size_id' => $label50x35?->id,
                    'profile_id' => $pLabel->id,
                    'config' => [
                        'barcodeFormat' => 'code128',
                        'showPrice' => true,
                        'showSku' => true,
                        'showName' => true,
                        'showMfgDate' => true,
                        'showExpDate' => true,
                    ],
                ],
            ];

            foreach ($defaultTemplates as $dt) {
                $tpl = DocumentTemplate::updateOrCreate(
                    [
                        'tenant_id' => $tenant->id,
                        'document_type' => $dt['document_type'],
                        'name' => $dt['name'],
                    ],
                    [
                        'uuid' => (string) Str::uuid(),
                        'paper_size_id' => $dt['paper_size_id'],
                        'print_profile_id' => $dt['profile_id'],
                        'status' => 'active',
                        'is_default' => true,
                        'current_version' => 1,
                    ]
                );

                $version = DocumentTemplateVersion::updateOrCreate(
                    [
                        'tenant_id' => $tenant->id,
                        'template_id' => $tpl->id,
                        'version' => 1,
                    ],
                    [
                        'uuid' => (string) Str::uuid(),
                        'status' => 'active',
                        'change_summary' => 'System seed initial version',
                        'layout_config' => $dt['config'],
                    ]
                );

                $tpl->update(['active_version_id' => $version->id]);
            }
        }
    }
}
