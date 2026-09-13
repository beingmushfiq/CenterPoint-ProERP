<?php

declare(strict_types=1);

namespace App\Modules\Ecommerce\Controllers;

use App\Core\Audit\AuditAction;
use App\Core\Tenancy\TenantContext;
use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Storefront;
use App\Models\StorefrontPage;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

final class StorefrontPageBuilderController extends Controller
{
    private function getTenantStorefront(int $tenantId): Storefront
    {
        $tenant = TenantContext::current()->tenant();
        return Storefront::firstOrCreate(
            ['tenant_id' => $tenantId],
            [
                'uuid' => (string) Str::uuid(),
                'name' => $tenant['name'] ?? 'Storefront',
                'subdomain' => $tenant['slug'] ?? 'store-' . $tenantId,
                'status' => 'live',
                'currency' => $tenant['currency_code'] ?? 'USD',
            ]
        );
    }

    /**
     * Tenant Admin: List all CMS pages
     */
    public function index(Request $request): JsonResponse
    {
        $tenantId = TenantContext::current()->tenantId();
        $storefront = $this->getTenantStorefront($tenantId);

        $pages = StorefrontPage::where('tenant_id', $tenantId)
            ->where('storefront_id', $storefront->id)
            ->orderBy('sort_order')
            ->orderBy('title')
            ->get();

        if ($pages->isEmpty()) {
            $this->seedDefaultPages($tenantId, $storefront->id);
            $pages = StorefrontPage::where('tenant_id', $tenantId)
                ->where('storefront_id', $storefront->id)
                ->orderBy('sort_order')
                ->orderBy('title')
                ->get();
        }

        return response()->json([
            'success' => true,
            'data' => $pages,
        ]);
    }

    /**
     * Seed standard default CMS pages for storefront
     */
    public function seedDefaultPages(int $tenantId, int $storefrontId): void
    {
        $storefront = Storefront::find($storefrontId);
        $brandName = $storefront?->name ?? 'Official Store';
        $storeSlug = $storefront?->subdomain ?? 'store';

        $defaultPages = [
            // 1. Flagship Homepage
            [
                'title' => 'Storefront Homepage',
                'slug' => 'home',
                'page_type' => 'home',
                'meta_title' => "Official Storefront — Precision Acoustics & Studio Hardware — {$brandName}",
                'meta_description' => "Discover authentic collections, CNC billet aluminum audio, reference displays, and direct cleanroom fulfillment from {$brandName}.",
                'status' => 'published',
                'sort_order' => 0,
                'blocks' => [
                    [
                        'id' => 'b_hero',
                        'type' => 'hero_banner',
                        'badge' => 'Flagship Release • 2026 Studio Edition',
                        'title' => 'Monolithic Precision. Zero Acoustic Distortion.',
                        'subtitle' => 'Explore professional-grade audio monitoring, reference displays, and CNC-machined mechanical hardware built from solid aerospace billet aluminum.',
                        'cta_text' => 'Configure Flagship',
                        'cta_url' => '#catalog',
                        'secondary_cta_text' => 'The Hardware Manifesto',
                        'secondary_cta_url' => "/store/{$storeSlug}/pages/about-us",
                        'settings' => [
                            'slides' => [
                                [
                                    'id' => 'sld_1',
                                    'badge' => 'Flagship Release • 2026 Studio Edition',
                                    'title' => 'Monolithic Precision. Zero Acoustic Distortion.',
                                    'subtitle' => 'Explore professional-grade audio monitoring, reference displays, and CNC-machined mechanical hardware built from solid aerospace billet aluminum.',
                                    'cta_text' => 'Configure Flagship',
                                    'cta_url' => '#catalog',
                                    'secondary_cta_text' => 'The Hardware Manifesto',
                                    'secondary_cta_url' => "/store/{$storeSlug}/pages/about-us",
                                    'desktop_image' => 'https://images.unsplash.com/photo-1546776310-eef45dd6d63c?auto=format&fit=crop&w=1800&q=85',
                                    'text_align' => 'left',
                                    'overlay_opacity' => 40,
                                ],
                                [
                                    'id' => 'sld_2',
                                    'badge' => 'Precision Workspace • Ultra-Wide OLED',
                                    'title' => 'Reference Color Purity. 240Hz Fluidity.',
                                    'subtitle' => 'True 10-bit color reproduction with 99.8% DCI-P3 gamut, factory delta-E < 0.8 calibration, and an integrated Thunderbolt 4 unibody dock.',
                                    'cta_text' => 'View Reference Display',
                                    'cta_url' => '#catalog',
                                    'secondary_cta_text' => 'Custom Lab',
                                    'secondary_cta_url' => "/store/{$storeSlug}/pages/custom-lab",
                                    'desktop_image' => 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&w=1800&q=85',
                                    'text_align' => 'left',
                                    'overlay_opacity' => 45,
                                ],
                                [
                                    'id' => 'sld_3',
                                    'badge' => 'Tactile Engineering • Hot-Swap Billet 75%',
                                    'title' => 'Acoustic Poron Gasket. 6-Layer ENIG Gold.',
                                    'subtitle' => 'Machined brass counter-weight, pre-lubed POM stabilizers, and open-source QMK/VIA firmware for complete keystroke authority.',
                                    'cta_text' => 'Explore Mechanical',
                                    'cta_url' => '#catalog',
                                    'secondary_cta_text' => 'Warranty Support',
                                    'secondary_cta_url' => "/store/{$storeSlug}/pages/warranty-support",
                                    'desktop_image' => 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&w=1800&q=85',
                                    'text_align' => 'left',
                                    'overlay_opacity' => 50,
                                ],
                            ],
                            'autoplay' => true,
                            'duration' => 6000,
                        ],
                    ],
                    [
                        'id' => 'b_props',
                        'type' => 'value_props',
                        'title' => 'The Hardware Integrity Standard',
                        'subtitle' => 'Engineered for durability, open serviceability, and lasting performance',
                        'items' => [
                            ['icon' => 'shield', 'title' => 'Aerospace Billet 6061-T6', 'desc' => '5-axis CNC machined monolithic unibodies providing structural rigidity and thermal dissipation.'],
                            ['icon' => 'award', 'title' => 'Zero Harmonic Distortion', 'desc' => 'Anechoically tuned acoustic chambers with beryllium drivers delivering flat reference frequency curves.'],
                            ['icon' => 'tool', 'title' => 'Modular Hot-Swap Architecture', 'desc' => 'Zero proprietary glues. Torx-fastened enclosures designed for effortless self-servicing and upgrades.'],
                            ['icon' => 'truck', 'title' => '2-Year Advance Replacement', 'desc' => 'Immediate express cross-shipment before you even return defective units with prepaid return labels.'],
                        ],
                    ],
                    [
                        'id' => 'b_categories',
                        'type' => 'trending_categories',
                        'title' => 'Engineered Disciplines',
                        'subtitle' => 'Select a hardware category to inspect specifications and bench test results',
                    ],
                    [
                        'id' => 'b_products',
                        'type' => 'featured_products',
                        'title' => 'Flagship Hardware Catalog',
                        'subtitle' => 'Explore production-run instruments available for immediate cleanroom dispatch.',
                        'category_id' => null,
                        'limit' => 12,
                        'show_search' => true,
                        'show_categories' => true,
                        'settings' => [
                            'card_style' => 'commerce',
                            'columns_desktop' => 4,
                            'columns_tablet' => 3,
                            'columns_mobile' => 2,
                            'show_badge' => true,
                            'show_quick_view' => true,
                            'show_rating' => true,
                        ],
                    ],
                    [
                        'id' => 'b_promo',
                        'type' => 'promo_split_banner',
                        'badge' => 'Founders Edition',
                        'title' => 'Chrono-Amp Titanium Reference Preamp',
                        'subtitle' => 'A limited run of 500 numbered units milled from solid Grade 5 titanium billet with dual ESS Sabre 9038PRO DAC chips and discreet Class-A output.',
                        'cta_text' => 'Reserve Serial Number',
                        'cta_url' => "/store/{$storeSlug}/pages/custom-lab",
                    ],
                    [
                        'id' => 'b_quality',
                        'type' => 'quality_journey',
                        'title' => 'The 5-Stage Precision Manufacturing Lifecycle',
                        'subtitle' => 'How every unit transforms from raw metallurgical billet to certified acoustic instrument',
                        'steps' => [
                            ['step' => '01', 'title' => 'Monolithic 5-Axis Milling', 'desc' => 'Ingot of 6061-T6 aluminum carved continuously over 4.5 hours with diamond tooling to ±0.01mm tolerance.'],
                            ['step' => '02', 'title' => 'Dual PVD Anodizing', 'desc' => 'Micro-arc electrochemical oxidation followed by physical vapor deposition for indestructible surface hardness.'],
                            ['step' => '03', 'title' => 'SMT Cleanroom Solder', 'desc' => 'High-frequency surface mount soldering under Class 1000 laminar flow using lead-free silver alloy solder.'],
                            ['step' => '04', 'title' => 'Anechoic Chamber Sweep', 'desc' => 'Every driver is measured across a 10Hz to 48kHz acoustic sweep to ensure tight ±0.5dB stereo matching.'],
                            ['step' => '05', 'title' => 'Nitrogen Sealed Dispatch', 'desc' => 'Laser serialized, bagged in nitrogen-purged static barrier foil, and protected by tamper-evident forensic tape.'],
                        ],
                    ],
                    [
                        'id' => 'b_spec_visualizer',
                        'type' => 'custom_html_css',
                        'html' => '<div style="background: radial-gradient(circle at 50% 0%, #18181b 0%, #09090b 100%); border: 1px solid rgba(255,255,255,0.12); border-radius: 1.5rem; padding: 2.5rem; color: #fff; font-family: ui-monospace, monospace;"><div style="display:flex; justify-content:space-between; align-items:baseline; flex-wrap:wrap; gap:1rem;"><div><span style="color:#10b981; font-size:0.7rem; font-weight:700; text-transform:uppercase; letter-spacing:0.1em;">Real-Time Telemetry Sandbox</span><h3 style="font-size:1.3rem; font-weight:700; margin:0.25rem 0; font-family:sans-serif;">Acoustic Frequency Response & Bit-Perfect Bench</h3></div><span style="font-size:0.75rem; color:#10b981; background:rgba(16,185,129,0.1); padding:0.25rem 0.75rem; border-radius:9999px; border:1px solid rgba(16,185,129,0.2);">Hi-Res Certified 384kHz / 32-Bit</span></div><div style="margin:2rem 0 1rem 0; padding:1.5rem; background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.06); border-radius:1rem; text-align:center;"><svg viewBox="0 0 700 140" style="width:100%; max-height:140px; display:block;"><path d="M 0 70 Q 150 68, 250 66 T 450 65 T 600 68 T 700 70" fill="none" stroke="#10b981" stroke-width="3" /><path d="M 0 70 Q 150 68, 250 66 T 450 65 T 600 68 T 700 70 L 700 140 L 0 140 Z" fill="rgba(16,185,129,0.08)" /><line x1="0" y1="70" x2="700" y2="70" stroke="rgba(255,255,255,0.15)" stroke-dasharray="4" /><text x="20" y="30" fill="#71717a" font-size="12">10 Hz</text><text x="330" y="30" fill="#10b981" font-size="12">1 kHz (0.0 dB Ref)</text><text x="630" y="30" fill="#71717a" font-size="12">48 kHz</text></svg></div><div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(140px, 1fr)); gap:1rem; border-top:1px solid rgba(255,255,255,0.1); padding-top:1.5rem;"><div style="background:rgba(255,255,255,0.02); padding:1rem; border-radius:0.75rem;"><div style="font-size:0.65rem; color:#71717a;">THD+N RATIO</div><div style="font-size:1.1rem; font-weight:700; color:#10b981; margin-top:0.25rem;">0.00018%</div><div style="font-size:0.7rem; color:#a1a1aa;">@ 1kHz, 32Ω Load</div></div><div style="background:rgba(255,255,255,0.02); padding:1rem; border-radius:0.75rem;"><div style="font-size:0.65rem; color:#71717a;">DYNAMIC RANGE</div><div style="font-size:1.1rem; font-weight:700; color:#f4f4f5; margin-top:0.25rem;">132.4 dB</div><div style="font-size:0.7rem; color:#a1a1aa;">A-Weighted</div></div><div style="background:rgba(255,255,255,0.02); padding:1rem; border-radius:0.75rem;"><div style="font-size:0.65rem; color:#71717a;">CHANNEL CROSSTALK</div><div style="font-size:1.1rem; font-weight:700; color:#f4f4f5; margin-top:0.25rem;">-128 dB</div><div style="font-size:0.7rem; color:#a1a1aa;">Isolated Ground</div></div><div style="background:rgba(255,255,255,0.02); padding:1rem; border-radius:0.75rem;"><div style="font-size:0.65rem; color:#71717a;">OUTPUT IMPEDANCE</div><div style="font-size:1.1rem; font-weight:700; color:#10b981; margin-top:0.25rem;">0.12 Ω</div><div style="font-size:0.7rem; color:#a1a1aa;">Near-Zero Damping</div></div></div></div>',
                        'css' => '.spec-box { width: 100%; box-sizing: border-box; }',
                    ],
                    [
                        'id' => 'b_faq',
                        'type' => 'faq',
                        'title' => 'Frequently Asked Questions & Technical Specifications',
                        'subtitle' => 'Everything you need to know about codecs, firmware, advance warranty, and cleanroom delivery.',
                        'faqs' => [
                            ['q' => 'What audio codecs and sampling rates are supported?', 'a' => 'Our DAC and acoustic systems provide bit-perfect hardware decoding for LDAC, aptX HD, aptX Lossless, AAC, and native DSD512 up to 384kHz / 32-bit.'],
                            ['q' => 'Can I remap keys and create macros without installing software?', 'a' => 'Yes! All mechanical hardware runs open-source QMK/VIA firmware. You can customize keymaps, layers, and lighting through any WebHID-compatible browser with zero background bloat.'],
                            ['q' => 'How does the 2-Year Precision Care Advance Replacement work?', 'a' => 'If any hardware defect occurs, we cross-ship a fresh, bench-calibrated replacement via express courier before you even pack the return. Return shipping is 100% covered.'],
                            ['q' => 'How are items packaged for transit?', 'a' => 'Each unit is vacuum-sealed in nitrogen-purged static barrier foil, surrounded by high-density custom molded bamboo-sugarcane armor, and tagged with an external 25G shock indicator.'],
                        ],
                    ],
                    [
                        'id' => 'b_vip',
                        'type' => 'newsletter_vip',
                        'title' => 'The Frequency • Private R&D Dispatch',
                        'subtitle' => 'Join 14,000+ sound designers, engineers, and creators. Receive early firmware builds, limited CNC batch drop alerts, and CAD schematics.',
                        'button_text' => 'Join Private R&D',
                    ],
                ],
            ],

            // 2. The Hardware Manifesto & About Us
            [
                'title' => 'About Us',
                'slug' => 'about-us',
                'page_type' => 'content',
                'meta_title' => "The Hardware Manifesto & Precision Engineering — {$brandName}",
                'meta_description' => "Learn about our obsession with physical precision: monolithic 6061-T6 aluminum milling, zero glue repairability, and acoustic cleanroom calibration.",
                'status' => 'published',
                'sort_order' => 1,
                'blocks' => [
                    [
                        'id' => 'b1',
                        'type' => 'hero_banner',
                        'badge' => 'The Hardware Manifesto',
                        'title' => 'Engineered for Permanence. Built Without Compromise.',
                        'subtitle' => 'We reject disposable tech and planned obsolescence. Every enclosure is CNC-milled from solid aerospace-grade aluminum, designed for full repairability, and calibrated to zero-harmonic acoustic standards.',
                        'cta_text' => 'Explore Custom Lab',
                        'cta_url' => "/store/{$storeSlug}/pages/custom-lab",
                        'secondary_cta_text' => 'Flagship Products',
                        'secondary_cta_url' => "/store/{$storeSlug}/products",
                        'settings' => [
                            'slides' => [
                                [
                                    'id' => 'sld_abt_1',
                                    'badge' => 'The Hardware Manifesto',
                                    'title' => 'Engineered for Permanence. Built Without Compromise.',
                                    'subtitle' => 'We reject disposable tech and planned obsolescence. Every enclosure is CNC-milled from solid aerospace-grade aluminum, designed for full repairability, and calibrated to zero-harmonic acoustic standards.',
                                    'cta_text' => 'Explore Custom Lab',
                                    'cta_url' => "/store/{$storeSlug}/pages/custom-lab",
                                    'secondary_cta_text' => 'Flagship Products',
                                    'secondary_cta_url' => "/store/{$storeSlug}/products",
                                    'desktop_image' => 'https://images.unsplash.com/photo-1546776310-eef45dd6d63c?auto=format&fit=crop&w=1800&q=85',
                                    'overlay_opacity' => 45,
                                ],
                            ],
                            'autoplay' => false,
                        ],
                    ],
                    [
                        'id' => 'b2',
                        'type' => 'rich_text',
                        'title' => 'The Architectural Manifesto: Tactile Integrity',
                        'content' => "Our hardware exists at the intersection of raw material purity and cutting-edge signal engineering.\n\nUnlike consumer electronics sealed with toxic glues and designed to fail after two fiscal quarters, our chassis are fastened with precision Torx screws. Internal boards use standardized ribbon interconnects. Drivers are isolated on silicone dampening rings to eliminate sympathetic chassis resonances.\n\nWhen you hold our hardware, you feel the mass of monolithic metal, the unmistakable tactile feedback of rotary optical encoders, and the quiet confidence of hardware built to outlive its owner.",
                    ],
                    [
                        'id' => 'b3',
                        'type' => 'quality_journey',
                        'title' => 'The Monolithic Lifecycle: From Raw Ingot to Calibrated Instrument',
                        'subtitle' => 'Every unit passes through 5 stages of microscopic verification before dispatch',
                        'steps' => [
                            ['step' => '01', 'title' => '6061-T6 Billet Milling', 'desc' => 'Solid monolithic aerospace blocks carved over 4.5 hours with 5-axis CNC cutters down to ±0.01mm tolerance.'],
                            ['step' => '02', 'title' => 'Dual-Stage PVD Anodizing', 'desc' => 'Electrochemical oxide conversion followed by physical vapor deposition for unmatched surface hardness.'],
                            ['step' => '03', 'title' => 'SMT Cleanroom Solder', 'desc' => 'Lead-free silver alloy solder runs on 6-layer ENIG gold-plated PCBs under Class 1000 laminar flow.'],
                            ['step' => '04', 'title' => 'Anechoic Sweep Calibration', 'desc' => 'Individual microphone and driver frequency response matching inside our soundproof acoustic chamber.'],
                            ['step' => '05', 'title' => 'Thermal & Voltage Burn-In', 'desc' => '48 hours of continuous 60°C thermal cycling and peak power load before final serialization.'],
                        ],
                    ],
                    [
                        'id' => 'b4',
                        'type' => 'value_props',
                        'title' => 'Engineering Pillars',
                        'subtitle' => 'Uncompromising standards embedded into every millimeter',
                        'items' => [
                            ['icon' => 'shield', 'title' => '10-Year Part Guarantee', 'desc' => 'Replacement switches, drivers, and chassis panels stocked for a full decade.'],
                            ['icon' => 'tool', 'title' => 'Open-Source QMK/VIA', 'desc' => 'Uncompromised firmware flexibility with zero background bloatware or cloud requirements.'],
                            ['icon' => 'award', 'title' => 'Beryllium Acoustic Drivers', 'desc' => 'Ultra-stiff, ultra-light diaphragm geometry delivering distortion-free frequency response up to 48kHz.'],
                            ['icon' => 'recycle', 'title' => '100% Recycled Alloys', 'desc' => 'Sustainable precision: scrap CNC chips are remelted and forged into next-generation chassis.'],
                        ],
                    ],
                    [
                        'id' => 'b5',
                        'type' => 'custom_html_css',
                        'html' => '<div style="background: radial-gradient(circle at 50% 0%, #18181b 0%, #09090b 100%); color: #fff; padding: 2.5rem; border-radius: 1.5rem; border: 1px solid rgba(255,255,255,0.1); font-family: ui-monospace, monospace;"><div style="display:flex; justify-content:space-between; align-items:baseline; flex-wrap:wrap; gap:1rem;"><div><span style="font-size:0.65rem; font-weight:700; color:#10b981; text-transform:uppercase; letter-spacing:0.1em;">Interactive Architecture Explorer</span><h3 style="font-size:1.25rem; font-weight:700; margin:0; color:#fff; font-family:sans-serif;">Precision Chassis Tolerances & Layering</h3></div><span style="font-size:0.75rem; color:#10b981; background:rgba(16,185,129,0.1); padding:0.25rem 0.75rem; border-radius:9999px; border:1px solid rgba(16,185,129,0.2);">ISO 9001:2015 Verified</span></div><div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:1rem; margin-top:1.5rem;"><div style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:1rem; padding:1.25rem;"><span style="font-size:0.65rem; font-weight:700; color:#10b981;">Layer 01 • Faceplate</span><div style="font-size:1.1rem; font-weight:700; color:#f4f4f5; margin:0.25rem 0;">±0.008 mm</div><div style="font-size:0.7rem; color:#71717a;">CNC Billet 6061-T6 Aluminum with Bead-Blasted 120-Grit Micro Texture.</div></div><div style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:1rem; padding:1.25rem;"><span style="font-size:0.65rem; font-weight:700; color:#10b981;">Layer 02 • Acoustic Gasket</span><div style="font-size:1.1rem; font-weight:700; color:#f4f4f5; margin:0.25rem 0;">2.8 mm Poron®</div><div style="font-size:0.7rem; color:#71717a;">High-density closed-cell microcellular polyurethane absorbing 98.4% of harmonic bounce.</div></div><div style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:1rem; padding:1.25rem;"><span style="font-size:0.65rem; font-weight:700; color:#10b981;">Layer 03 • Mainboard</span><div style="font-size:1.1rem; font-weight:700; color:#f4f4f5; margin:0.25rem 0;">6-Layer ENIG Gold</div><div style="font-size:0.7rem; color:#71717a;">2oz copper power planes with Kailh hot-swap sockets rated for 50,000+ actuations.</div></div><div style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:1rem; padding:1.25rem;"><span style="font-size:0.65rem; font-weight:700; color:#10b981;">Layer 04 • Weighted Base</span><div style="font-size:1.1rem; font-weight:700; color:#f4f4f5; margin:0.25rem 0;">1,480 Grams</div><div style="font-size:0.7rem; color:#71717a;">Machined solid brass counter-weight with flush-mounted PVD silicone isolation feet.</div></div></div></div>',
                    ],
                    [
                        'id' => 'b6',
                        'type' => 'newsletter_vip',
                        'title' => 'Join the Private Hardware Lab',
                        'subtitle' => 'Receive restricted engineering schematics, early prototype dispatches, and private batch drop notifications.',
                        'button_text' => 'Request Lab Access',
                    ],
                ],
            ],

            // 3. Warranty & Advance Replacement Support
            [
                'title' => 'Warranty & Rapid Replacement',
                'slug' => 'warranty-support',
                'page_type' => 'warranty',
                'meta_title' => "2-Year Precision Care & Rapid Replacement Warranty — {$brandName}",
                'meta_description' => "Review our official 2-year advance warranty, cross-shipment terms, serial number telemetry check, and repair policies.",
                'status' => 'published',
                'sort_order' => 2,
                'blocks' => [
                    [
                        'id' => 'b1',
                        'type' => 'hero_banner',
                        'badge' => 'Advance Hardware Protection',
                        'title' => '2-Year Precision Care & Rapid Replacement',
                        'subtitle' => 'We stand behind every solder joint and machining tolerance. If hardware malfunctions, we cross-ship a replacement before you even pack the return.',
                        'cta_text' => 'Check Serial Warranty',
                        'cta_url' => '#lookup',
                        'secondary_cta_text' => 'Read RMA Protocol',
                        'secondary_cta_url' => '#protocol',
                    ],
                    [
                        'id' => 'b2',
                        'type' => 'value_props',
                        'title' => 'The Concierge Warranty Standard',
                        'subtitle' => 'Zero downtime and no bureaucratic friction',
                        'items' => [
                            ['icon' => 'truck', 'title' => '24-Hour Cross-Shipment', 'desc' => 'Replacement units are dispatched on express air transit prior to receiving defective items.'],
                            ['icon' => 'shield', 'title' => 'Hardware Concierge', 'desc' => 'Direct access to senior firmware and acoustic engineers, not outsourced call centers.'],
                            ['icon' => 'award', 'title' => 'Zero Deductible', 'desc' => 'Zero hidden repair fees, zero deductibles, and prepaid courier return labels included.'],
                            ['icon' => 'tool', 'title' => 'Right-to-Repair Friendly', 'desc' => 'Opening the chassis does not void your warranty. Self-repair guides and parts are freely provided.'],
                        ],
                    ],
                    [
                        'id' => 'b3',
                        'type' => 'custom_html_css',
                        'html' => '<div id="lookup" style="background:#09090b; border:1px solid rgba(255,255,255,0.12); border-radius:1.5rem; padding:2rem; color:#fff; font-family:ui-monospace, monospace;"><span style="color:#10b981; font-size:0.7rem; font-weight:700; text-transform:uppercase;">Factory Diagnostic & Telemetry Lookup</span><h3 style="font-size:1.25rem; font-weight:700; margin:0.25rem 0 0.5rem 0; font-family:sans-serif;">Verify Your Serial Number</h3><p style="font-size:0.75rem; color:#a1a1aa; margin:0;">Enter the 10-digit laser-etched serial from the backplate of your chassis to view warranty status and calibration logs.</p><div style="display:flex; gap:0.75rem; margin-top:1rem; flex-wrap:wrap;"><input type="text" value="SN-X9-9842-PRO" readonly style="flex:1; min-width:240px; background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.15); border-radius:0.75rem; padding:0.75rem 1rem; color:#fff; font-size:0.85rem;" /><button onclick="alert(\'Telemetry Verified: Serial SN-X9-9842-PRO is Active under 2-Year Precision Care through December 2028.\')" style="background:#10b981; color:#000; font-weight:700; border:none; border-radius:0.75rem; padding:0.75rem 1.5rem; cursor:pointer; font-size:0.85rem;">Check Telemetry</button></div><div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:1rem; margin-top:1.5rem; border-top:1px solid rgba(255,255,255,0.1); padding-top:1.5rem;"><div style="background:rgba(255,255,255,0.02); padding:1rem; border-radius:0.75rem;"><div style="font-size:0.65rem; color:#71717a;">DEVICE STATUS</div><div style="font-size:0.95rem; font-weight:700; color:#10b981; margin-top:0.25rem;">ACTIVE COVERAGE</div><div style="font-size:0.7rem; color:#a1a1aa;">Valid through 2028</div></div><div style="background:rgba(255,255,255,0.02); padding:1rem; border-radius:0.75rem;"><div style="font-size:0.65rem; color:#71717a;">MANUFACTURING BATCH</div><div style="font-size:0.95rem; font-weight:700; color:#f4f4f5; margin-top:0.25rem;">BILLET LOT #049</div><div style="font-size:0.7rem; color:#a1a1aa;">CNC Precision Mill A-3</div></div><div style="background:rgba(255,255,255,0.02); padding:1rem; border-radius:0.75rem;"><div style="font-size:0.65rem; color:#71717a;">CALIBRATION THD+N</div><div style="font-size:0.95rem; font-weight:700; color:#f4f4f5; margin-top:0.25rem;">0.00018%</div><div style="font-size:0.7rem; color:#a1a1aa;">Passed Chamber Sweep</div></div><div style="background:rgba(255,255,255,0.02); padding:1rem; border-radius:0.75rem;"><div style="font-size:0.65rem; color:#71717a;">RAPID RMA STATUS</div><div style="font-size:0.95rem; font-weight:700; color:#10b981; margin-top:0.25rem;">ELIGIBLE (24h)</div><div style="font-size:0.7rem; color:#a1a1aa;">Air Cross-Ship Available</div></div></div></div>',
                    ],
                    [
                        'id' => 'b4',
                        'type' => 'faq',
                        'title' => 'Precision Care & RMA Questions',
                        'subtitle' => 'Clear, transparent answers on coverage, cross-shipments, and firmware recovery',
                        'faqs' => [
                            ['q' => 'What is covered under the 2-Year Precision Care Warranty?', 'a' => 'Everything from internal DAC circuitry, display panel backlights, switch socket fatigue, rotary encoders, and mechanical chassis integrity is covered 100% against defects.'],
                            ['q' => 'How does the 24-Hour Cross-Shipment process work?', 'a' => 'Once our engineering desk verifies your telemetry log, a fresh calibrated replacement is dispatched via express courier with a prepaid return carton for your existing unit.'],
                            ['q' => 'Does modding my keyboard switches or opening the chassis void the warranty?', 'a' => 'No! We encourage user servicing and modding. As long as internal traces are not intentionally damaged, opening your device or swapping components maintains full warranty coverage.'],
                            ['q' => 'How do I download firmware updates and factory calibrations?', 'a' => 'Firmware packages are cryptographically signed and available directly through our web configurator with zero desktop software required.'],
                        ],
                    ],
                    [
                        'id' => 'b5',
                        'type' => 'rich_text',
                        'title' => 'The Advance Replacement Protocol',
                        'content' => "1. Diagnostic Telemetry: Check your device serial number above or send an error report to our engineering desk.\n2. Cross-Ship Dispatch: A verified replacement unit is packed in our cleanroom and dispatched via express courier within 24 hours.\n3. Doorstep Handshake: Hand the return unit to the courier in the provided shock-proof return carton. Zero waiting, zero downtime.",
                    ],
                ],
            ],

            // 4. Shipping & Logistics Protocol
            [
                'title' => 'Armored Shipping & Logistics',
                'slug' => 'shipping-fulfillment',
                'page_type' => 'shipping',
                'meta_title' => "Armored Transit & Global Fulfillment Protocol — {$brandName}",
                'meta_description' => "Inspect our tamper-evident shock-monitored packaging, nitrogen vacuum sealing, and express global courier transit corridors.",
                'status' => 'published',
                'sort_order' => 3,
                'blocks' => [
                    [
                        'id' => 'b1',
                        'type' => 'hero_banner',
                        'badge' => 'Armored Global Logistics',
                        'title' => 'Delivered with Surgical Precision',
                        'subtitle' => 'Every instrument is sealed in moisture-barrier foil with calibrated shock sensors and routed via direct air-freight corridors.',
                        'cta_text' => 'Track Active Parcel',
                        'cta_url' => "/store/{$storeSlug}/track",
                        'secondary_cta_text' => 'Packaging Specs',
                        'secondary_cta_url' => '#specs',
                    ],
                    [
                        'id' => 'b2',
                        'type' => 'value_props',
                        'title' => 'Armored Transit Pillars',
                        'subtitle' => 'Packaging engineered like an aircraft flight recorder',
                        'items' => [
                            ['icon' => 'box', 'title' => 'Impact-Monitored Cartons', 'desc' => 'Integrated 25G shock-indicator labels ensure your instrument suffered zero transit drops.'],
                            ['icon' => 'shield', 'title' => 'Vacuum Nitrogen Packaging', 'desc' => 'Optical components and delicate switches sealed in nitrogen-purged ESD anti-static pouches.'],
                            ['icon' => 'truck', 'title' => 'Direct Air Priority', 'desc' => 'International shipments bypass regional sorting hubs and fly direct to metropolitan hubs.'],
                            ['icon' => 'award', 'title' => 'Tamper-Proof Hologram', 'desc' => 'Void-indicating forensic tape on all carton seams guarantees virgin factory unboxing.'],
                        ],
                    ],
                    [
                        'id' => 'b3',
                        'type' => 'quality_journey',
                        'title' => 'The Armored Fulfillment Journey',
                        'subtitle' => 'From cleanroom nitrogen sealing to your desktop setup',
                        'steps' => [
                            ['step' => '01', 'title' => 'ESD Nitrogen Sealing', 'desc' => 'Unit is wiped with isopropyl, grounded, and vacuum-sealed with desiccant in nitrogen-purged foil.'],
                            ['step' => '02', 'title' => 'Custom Molded Pulp Core', 'desc' => 'Encased in high-density recycled fiber armor engineered to absorb 50G drop impacts.'],
                            ['step' => '03', 'title' => 'Shock Sensor Application', 'desc' => 'A tamper-evident 25G g-force impact indicator is affixed to the carton exterior.'],
                            ['step' => '04', 'title' => 'Armored Courier Handover', 'desc' => 'Direct handover to priority air couriers with climate-controlled hold compartments.'],
                            ['step' => '05', 'title' => 'White-Glove Doorstep Delivery', 'desc' => 'Verified signature delivery with courier inspection check before acceptance.'],
                        ],
                    ],
                    [
                        'id' => 'b4',
                        'type' => 'faq',
                        'title' => 'Shipping & Delivery Specifications',
                        'subtitle' => 'Everything about dispatch cutoffs, transit times, and packaging seals',
                        'faqs' => [
                            ['q' => 'What is the shock sensor on my carton?', 'a' => 'Every package carries a calibrated 25G impact indicator. If the indicator has turned red upon arrival, document it with the courier and our team will dispatch a replacement immediately.'],
                            ['q' => 'How quickly are orders fulfilled?', 'a' => 'In-stock hardware orders placed before 3:00 PM EST are sealed and dispatched the same day. Custom anodized orders dispatch within 3–5 business days.'],
                            ['q' => 'Do you ship internationally?', 'a' => 'Yes, we ship to over 85 countries with all customs duties, VAT, and brokerage fees calculated and prepaid at checkout.'],
                        ],
                    ],
                    [
                        'id' => 'b5',
                        'type' => 'rich_text',
                        'title' => 'Carton Architecture & Environmental Standards',
                        'content' => "All packaging materials are 100% plastic-free, utilizing high-density bamboo and sugarcane molded pulp cores engineered to withstand extreme hydrostatic pressures and temperature swings from -20°C to 55°C. Every order is fully insured with door-to-door courier tracking.",
                    ],
                ],
            ],

            // 5. Custom Hardware Lab (Bespoke Studio Hardware)
            [
                'title' => 'Custom Hardware Lab',
                'slug' => 'custom-lab',
                'page_type' => 'lab',
                'meta_title' => "Custom Hardware Lab & Bespoke Studio Commissions — {$brandName}",
                'meta_description' => "Commission bespoke CNC anodized aluminum finishes, fiber laser serialization, and custom audio tuning for your production studio.",
                'status' => 'published',
                'sort_order' => 4,
                'blocks' => [
                    [
                        'id' => 'b1',
                        'type' => 'hero_banner',
                        'badge' => 'Bespoke Studio Hardware',
                        'title' => 'The Custom Hardware Lab',
                        'subtitle' => 'Commission one-of-a-kind CNC anodized finishes, laser vector serialization, and custom-tuned acoustic drivers for your production studio or executive desk.',
                        'cta_text' => 'Open Finish Configurator',
                        'cta_url' => '#configurator',
                        'secondary_cta_text' => 'Explore Catalog',
                        'secondary_cta_url' => "/store/{$storeSlug}/products",
                    ],
                    [
                        'id' => 'b2',
                        'type' => 'value_props',
                        'title' => 'Bespoke Capabilities',
                        'subtitle' => 'Industrial customization crafted for discerning creators',
                        'items' => [
                            ['icon' => 'tool', 'title' => 'Pantone Billet Anodizing', 'desc' => 'Type III hardcoat electrochemical anodizing tailored to your studio interior palette.'],
                            ['icon' => 'award', 'title' => 'Fiber Laser Vector Etching', 'desc' => 'Sub-micron laser engraving for personalized callsigns, serial numbers, and studio branding.'],
                            ['icon' => 'sliders', 'title' => 'Bespoke Rotary Encoders', 'desc' => 'Choose from knurled brass, fluted titanium, or matte ceramic haptic dials.'],
                            ['icon' => 'code', 'title' => 'Custom Firmware Profiles', 'desc' => 'Factory-flashed QMK keymaps, macro banks, and customized OLED boot animations.'],
                        ],
                    ],
                    [
                        'id' => 'b3',
                        'type' => 'custom_html_css',
                        'html' => '<div id="configurator" style="background:#09090b; border:1px solid rgba(255,255,255,0.12); border-radius:1.5rem; padding:2.5rem; color:#fff; font-family:ui-monospace, monospace;"><span style="color:#10b981; font-size:0.7rem; font-weight:700; text-transform:uppercase;">Live Anodizing Studio</span><h3 style="font-size:1.3rem; font-weight:700; margin:0.25rem 0; font-family:sans-serif;">Select Monolithic Metal Alloy & Finish</h3><p style="font-size:0.8rem; color:#a1a1aa; margin:0;">Interactive 5-Axis billet rendering with real-time electrolytic pigment visualization.</p><div style="display:flex; gap:0.75rem; margin-top:1rem; flex-wrap:wrap;"><div style="width:36px; height:36px; border-radius:50%; background:#27272a; border:2px solid #10b981; cursor:pointer;" title="Space Titanium (Standard)" onclick="alert(\'Selected Space Titanium (Hardcoat Grade 5)\')"></div><div style="width:36px; height:36px; border-radius:50%; background:#09090b; border:2px solid #52525b; cursor:pointer;" title="Deep Obsidian" onclick="alert(\'Selected Deep Obsidian (Dual PVD Black)\')"></div><div style="width:36px; height:36px; border-radius:50%; background:#e4e4e7; border:2px solid #52525b; cursor:pointer;" title="Raw Satin Billet" onclick="alert(\'Selected Raw Satin Billet (Clear Anodized)\')"></div><div style="width:36px; height:36px; border-radius:50%; background:#d97706; border:2px solid #52525b; cursor:pointer;" title="Cyber Amber" onclick="alert(\'Selected Cyber Amber (Electrolytic Bronze)\')"></div><div style="width:36px; height:36px; border-radius:50%; background:#047857; border:2px solid #52525b; cursor:pointer;" title="Nordic Forest" onclick="alert(\'Selected Nordic Forest (Deep Alpine Green)\')"></div></div><div style="background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.08); border-radius:1rem; padding:2rem; text-align:center; margin-top:1.5rem;"><svg width="220" height="110" viewBox="0 0 220 110" style="margin:0 auto; display:block;"><rect x="10" y="15" width="200" height="80" rx="14" fill="#27272a" stroke="#10b981" stroke-width="2" /><circle cx="180" cy="55" r="18" fill="#18181b" stroke="#71717a" stroke-width="2" /><circle cx="180" cy="55" r="8" fill="#10b981" /><rect x="30" y="35" width="115" height="12" rx="4" fill="#3f3f46" /><rect x="30" y="55" width="85" height="12" rx="4" fill="#3f3f46" /></svg><div style="font-size:0.85rem; font-weight:700; color:#f4f4f5; margin-top:1rem;">Flagship Studio Workstation Chassis • Space Titanium</div><div style="font-size:0.7rem; color:#10b981; margin-top:0.25rem;">Includes Laser-Etched Studio Serial & Flight Case</div></div><div style="display:flex; justify-content:space-around; margin-top:1.5rem; border-top:1px solid rgba(255,255,255,0.1); padding-top:1rem; font-size:0.75rem; flex-wrap:wrap; gap:0.5rem;"><div><span style="color:#71717a;">ALLOY:</span> <b>6061-T6 Billet</b></div><div><span style="color:#71717a;">TOLERANCE:</span> <b>±0.005 mm</b></div><div><span style="color:#71717a;">LEAD TIME:</span> <b>14 Days</b></div><div><span style="color:#71717a;">SERIAL:</span> <b>1-of-1 Numbered</b></div></div></div>',
                    ],
                    [
                        'id' => 'b4',
                        'type' => 'quality_journey',
                        'title' => 'The Bespoke Commission Roadmap',
                        'subtitle' => 'How we turn your design vision into an heirloom electronic instrument',
                        'steps' => [
                            ['step' => '01', 'title' => 'Aesthetic Consultation', 'desc' => 'Collaborate with our industrial designers to define color codes, dial weights, and engraving vectors.'],
                            ['step' => '02', 'title' => 'CAD Blueprint Approval', 'desc' => 'Review high-precision 3D digital renders and mechanical cross-sections before milling.'],
                            ['step' => '03', 'title' => 'Dedicated CNC Run', 'desc' => 'Single-unit machine tool paths carved with diamond-tipped bits for flawless surface finish.'],
                            ['step' => '04', 'title' => 'Hand Polishing & Anodizing', 'desc' => 'Submerged in custom dye electrolyte baths with micron-level layer thickness verification.'],
                            ['step' => '05', 'title' => 'Serial Certification', 'desc' => 'Individually numbered (e.g. 01/01) and delivered in a custom hardwood flight case.'],
                        ],
                    ],
                    [
                        'id' => 'b5',
                        'type' => 'faq',
                        'title' => 'Custom Commission FAQ',
                        'subtitle' => 'Answers on minimum quantities, CAD files, and lead times',
                        'faqs' => [
                            ['q' => 'What is the lead time for bespoke studio hardware?', 'a' => 'Standard custom commissions require 2 to 3 weeks for CAD preparation, dedicated CNC machining, anodizing, and final calibration.'],
                            ['q' => 'Can you engrave custom studio logos or vector art?', 'a' => 'Yes! We accept SVG and DXF vector files for high-resolution fiber laser engraving on the backplate or rotary dial face.'],
                            ['q' => 'Is there a minimum order quantity for custom hardware?', 'a' => 'No. Our lab produces single bespoke 1-of-1 commissions as well as complete multi-workstation deployments for commercial studios.'],
                        ],
                    ],
                    [
                        'id' => 'b6',
                        'type' => 'newsletter_vip',
                        'title' => 'Bespoke Commission Queue',
                        'subtitle' => 'Our custom milling runs are limited to 25 units per month. Register your interest to secure an upcoming build slot.',
                        'button_text' => 'Join Commission Waitlist',
                    ],
                ],
            ],

            // 6. Help & FAQ
            [
                'title' => 'Help & FAQ',
                'slug' => 'faq',
                'page_type' => 'faq',
                'meta_title' => "Frequently Asked Questions & Technical Specifications — {$brandName}",
                'meta_description' => "Find answers to common questions about codecs, QMK firmware, 2-year advance warranty, and cleanroom delivery.",
                'status' => 'published',
                'sort_order' => 5,
                'blocks' => [
                    [
                        'id' => 'b1',
                        'type' => 'faq',
                        'title' => 'Frequently Asked Questions & Technical Specifications',
                        'subtitle' => 'Everything you need to know about our products, ordering, and delivery.',
                        'faqs' => [
                            ['q' => 'What quality standards do you maintain?', 'a' => 'All products undergo rigorous multi-stage quality assurance tests for durability, safety, and acoustic performance prior to dispatch.'],
                            ['q' => 'What warranty is provided with my purchase?', 'a' => 'All authentic products include our 2-Year Precision Care warranty with 24-hour advance replacement against defects.'],
                            ['q' => 'How long does delivery take?', 'a' => 'Standard deliveries are fulfilled within 2 to 4 business days depending on destination, with live shock-monitored status updates.'],
                            ['q' => 'Is Cash on Delivery (COD) supported?', 'a' => 'Yes, Cash on Delivery is supported for eligible delivery zones with parcel inspection upon arrival.'],
                        ],
                    ],
                ],
            ],

            // 7. Return & Legal Policy
            [
                'title' => 'Return & Warranty Policy',
                'slug' => 'return-policy',
                'page_type' => 'policy',
                'meta_title' => "Return, Replacement & Warranty Policy — {$brandName}",
                'meta_description' => 'Review our customer-first return, replacement, and warranty coverage policies.',
                'status' => 'published',
                'sort_order' => 6,
                'blocks' => [
                    [
                        'id' => 'b1',
                        'type' => 'rich_text',
                        'title' => '2-Year Precision Care & Replacement Guarantee',
                        'content' => 'If your product arrives damaged, defective, or does not match specifications, contact our customer support team for prompt inspection and 24-hour advance doorstep resolution.',
                    ],
                    [
                        'id' => 'b2',
                        'type' => 'rich_text',
                        'title' => 'Manufacturer Warranty Coverage',
                        'content' => 'All items purchased through our official storefront are backed by our standard warranty. We guarantee authentic parts, dedicated technical support, and responsive customer service.',
                    ],
                ],
            ],
        ];

        foreach ($defaultPages as $pageData) {
            StorefrontPage::updateOrCreate(
                [
                    'tenant_id' => $tenantId,
                    'storefront_id' => $storefrontId,
                    'slug' => $pageData['slug'],
                ],
                [
                    'uuid' => (string) Str::uuid(),
                    'title' => $pageData['title'],
                    'page_type' => $pageData['page_type'],
                    'meta_title' => $pageData['meta_title'],
                    'meta_description' => $pageData['meta_description'],
                    'status' => $pageData['status'],
                    'published_at' => now(),
                    'blocks' => $pageData['blocks'],
                    'sort_order' => $pageData['sort_order'],
                ]
            );
        }
    }

    /**
     * Tenant Admin: Seed or reset standard preset pages
     */
    public function seedDefaults(Request $request): JsonResponse
    {
        $tenantId = TenantContext::current()->tenantId();
        $storefront = $this->getTenantStorefront($tenantId);

        $this->seedDefaultPages($tenantId, $storefront->id);

        $pages = StorefrontPage::where('tenant_id', $tenantId)
            ->where('storefront_id', $storefront->id)
            ->orderBy('sort_order')
            ->orderBy('title')
            ->get();

        return response()->json([
            'success' => true,
            'message' => 'Default storefront pages seeded successfully.',
            'data' => $pages,
        ]);
    }

    /**
     * Tenant Admin: Create a new page
     */
    public function store(Request $request): JsonResponse
    {
        $tenantId = TenantContext::current()->tenantId();
        $storefront = $this->getTenantStorefront($tenantId);

        $validated = $request->validate([
            'title' => 'required|string|max:255',
            'slug' => 'nullable|string|max:128',
            'page_type' => 'nullable|string|in:home,content,policy,contact,faq,custom,warranty,shipping,lab',
            'meta_title' => 'nullable|string|max:255',
            'meta_description' => 'nullable|string',
            'status' => 'nullable|string|in:draft,published',
            'blocks' => 'nullable|array',
        ]);

        $slug = !empty($validated['slug'])
            ? Str::slug($validated['slug'])
            : Str::slug($validated['title']);

        // Prevent duplicate slugs
        $existing = StorefrontPage::where('tenant_id', $tenantId)
            ->where('storefront_id', $storefront->id)
            ->where('slug', $slug)
            ->first();

        if ($existing) {
            $slug .= '-' . Str::random(4);
        }

        $page = StorefrontPage::create([
            'tenant_id' => $tenantId,
            'uuid' => (string) Str::uuid(),
            'storefront_id' => $storefront->id,
            'title' => $validated['title'],
            'slug' => $slug,
            'page_type' => $validated['page_type'] ?? 'custom',
            'meta_title' => $validated['meta_title'] ?? $validated['title'],
            'meta_description' => $validated['meta_description'] ?? null,
            'status' => $validated['status'] ?? 'draft',
            'published_at' => ($validated['status'] ?? 'draft') === 'published' ? now() : null,
            'blocks' => $validated['blocks'] ?? [],
            'sort_order' => StorefrontPage::where('tenant_id', $tenantId)->count() + 1,
            'created_by' => $request->user()?->id,
        ]);

        $audit = new AuditLog();
        $audit->uuid = (string) Str::uuid();
        $audit->tenant_id = $tenantId;
        $audit->user_id = $request->user()?->id;
        $audit->action = AuditAction::Created;
        $audit->auditable_type = StorefrontPage::class;
        $audit->auditable_id = $page->id;
        $audit->after = ['title' => $page->title, 'slug' => $page->slug];
        $audit->created_at = now();
        $audit->save();

        return response()->json([
            'success' => true,
            'message' => 'Storefront page created successfully.',
            'data' => $page,
        ], 201);
    }

    /**
     * Tenant Admin: Get single page with blocks
     */
    public function show(Request $request, string|int $idOrSlug): JsonResponse
    {
        $tenantId = TenantContext::current()->tenantId();
        $storefront = $this->getTenantStorefront($tenantId);

        $query = StorefrontPage::where('tenant_id', $tenantId)
            ->where('storefront_id', $storefront->id);

        if (is_numeric($idOrSlug)) {
            $query->where('id', (int) $idOrSlug);
        } else {
            $query->where('slug', $idOrSlug);
        }

        $page = $query->firstOrFail();

        return response()->json([
            'success' => true,
            'data' => $page,
        ]);
    }

    /**
     * Tenant Admin: Update page details & content blocks
     */
    public function update(Request $request, int $id): JsonResponse
    {
        $tenantId = TenantContext::current()->tenantId();
        $page = StorefrontPage::where('tenant_id', $tenantId)->findOrFail($id);

        $validated = $request->validate([
            'title' => 'sometimes|required|string|max:255',
            'slug' => 'sometimes|required|string|max:128',
            'page_type' => 'sometimes|string|in:home,content,policy,contact,faq,custom,warranty,shipping,lab',
            'meta_title' => 'nullable|string|max:255',
            'meta_description' => 'nullable|string',
            'status' => 'sometimes|string|in:draft,published',
            'blocks' => 'sometimes|array',
            'sort_order' => 'nullable|integer',
        ]);

        if (isset($validated['slug'])) {
            $validated['slug'] = Str::slug($validated['slug']);
        }

        if (isset($validated['status'])) {
            if ($validated['status'] === 'published' && $page->status !== 'published') {
                $page->published_at = now();
            } elseif ($validated['status'] === 'draft') {
                $page->published_at = null;
            }
        }

        $page->update($validated);

        $audit = new AuditLog();
        $audit->uuid = (string) Str::uuid();
        $audit->tenant_id = $tenantId;
        $audit->user_id = $request->user()?->id;
        $audit->action = AuditAction::Updated;
        $audit->auditable_type = StorefrontPage::class;
        $audit->auditable_id = $page->id;
        $audit->after = ['title' => $page->title, 'status' => $page->status];
        $audit->created_at = now();
        $audit->save();

        return response()->json([
            'success' => true,
            'message' => 'Page updated successfully.',
            'data' => $page,
        ]);
    }

    /**
     * Tenant Admin: Delete page
     */
    public function destroy(Request $request, int $id): JsonResponse
    {
        $tenantId = TenantContext::current()->tenantId();
        $page = StorefrontPage::where('tenant_id', $tenantId)->findOrFail($id);

        if ($page->slug === 'home') {
            return response()->json([
                'success' => false,
                'message' => 'The storefront homepage cannot be deleted.',
            ], 422);
        }

        $page->delete();

        return response()->json([
            'success' => true,
            'message' => 'Page deleted successfully.',
        ]);
    }

    /**
     * Public Storefront: Get published page by slug for customer website
     */
    public function getPublicPage(Request $request, string $slug): JsonResponse
    {
        $tenantId = TenantContext::current()->tenantId();
        $page = StorefrontPage::where('tenant_id', $tenantId)
            ->where('slug', $slug)
            ->where('status', 'published')
            ->first();

        if (!$page) {
            return response()->json([
                'success' => false,
                'message' => "Page '{$slug}' not found or not published.",
            ], 404);
        }

        return response()->json([
            'success' => true,
            'data' => [
                'title' => $page->title,
                'slug' => $page->slug,
                'page_type' => $page->page_type,
                'meta_title' => $page->meta_title ?? $page->title,
                'meta_description' => $page->meta_description,
                'blocks' => $page->blocks ?? [],
                'published_at' => $page->published_at,
            ],
        ]);
    }
}
