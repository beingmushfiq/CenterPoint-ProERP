# 10 — CMS & Storefront Customization Mapping

**Status:** Completed  
**Date:** September 2026  
**Controllers Audited:** `StorefrontCustomizerController.php`, `StorefrontPageBuilderController.php`  
**Frontend Pages Audited:** `StorefrontHomePage.tsx`, `StorefrontDynamicPage.tsx`, `StorefrontProductDetailPage.tsx`

---

## 1. CMS to Storefront Architectural Seam

The tenant's e-commerce storefront is completely headless, driven by configuration retrieved from `GET /api/v1/storefront/config` and dynamic page blocks from `GET /api/v1/storefront/pages/{slug}`.

```
Tenant ERP CMS Admin
  (StorefrontCustomizerController & PageBuilder)
       ↓ Saves JSON schema into `storefronts.theme` and `storefront_pages.blocks`
Database Tables (`storefronts`, `storefront_pages`)
       ↓ Scoped by tenant subdomain / custom domain
Storefront Public API (`api/v1/storefront/config`, `api/v1/storefront/pages/*`)
       ↓ Consumed by React Storefront
Dynamic Component Renderer (`StorefrontBlockRenderer.tsx`)
```

---

## 2. Field-by-Field Connectivity Audit

| CMS Setting | Storage Field | Frontend Consumer Component | Status | Notes |
|---|---|---|---|---|
| **Primary Color** | `storefronts.theme.primary_color` | `StorefrontLayout.tsx` (CSS `--primary`) | **CONNECTED** | Dynamically applies to buttons, badges, links |
| **Hero Title / Subtitle** | `storefronts.theme.hero_title` | `StorefrontHomePage.tsx` | **CONNECTED** | Displays in main hero banner fallback |
| **Announcement Bar** | `storefronts.theme.announcement_*` | `StorefrontHeader.tsx` | **CONNECTED** | Supports custom text, bg, and text color |
| **Navigation Menu** | `storefronts.theme.menu_items` | `StorefrontHeader.tsx` | **CONNECTED** | Dynamic links to catalog & CMS pages |
| **Footer Columns** | `storefronts.theme.footer_columns` | `StorefrontFooter.tsx` | **CONNECTED** | Configurable link blocks |
| **WhatsApp Quick Order** | `storefronts.theme.footer_show_whatsapp` | `StorefrontFooter.tsx` & Product Detail | **CONNECTED** | Contextual order message with cart summary |
| **Social Links** | `storefronts.theme.social_links` | `StorefrontFooter.tsx` | **CONNECTED** | Facebook, Instagram, YouTube, X links |
| **Payment Badges** | `storefronts.theme.footer_payment_methods`| `StorefrontFooter.tsx` | **CONNECTED** | bKash, Nagad, Visa, Mastercard, COD |
| **Tracking Scripts** | `storefronts.theme.meta_pixel_id` | `StorefrontLayout.tsx` | **PARTIAL** | Script rendered, but lacks server-side CAPI event deduplication |
| **Theme Preset** | `storefronts.theme.theme_preset` | `StorefrontLayout.tsx` | **DISCONNECTED** | Preset name saved in DB, but has no CSS rules defined on frontend |

---

## 3. Dynamic Page Builder Blocks

`StorefrontPageBuilderController` stores modular blocks in `storefront_pages.blocks`:

| Block Type | Supported Properties | Storefront Renderer Component |
|---|---|---|
| `hero_slider` | Slides, autoplay, duration, headline, CTA button | `StorefrontBlockRenderer.tsx` |
| `category_grid` | Category IDs, column layout, display count | `StorefrontBlockRenderer.tsx` |
| `product_carousel`| Collection (`featured`, `new_arrivals`), limit | `StorefrontBlockRenderer.tsx` |
| `text_block` | Rich text HTML, headings, text alignment | `StorefrontBlockRenderer.tsx` |
| `faq_accordion` | Questions and answers (supports FAQ Schema) | `StorefrontBlockRenderer.tsx` |
| `contact_form` | Form fields, recipient email | `StorefrontBlockRenderer.tsx` |
| `banner_cta` | Background image, promo text, coupon code | `StorefrontBlockRenderer.tsx` |

---

## 4. Disconnected Fields & Defect Summary

1. **`theme_preset` has no effect:** The customizer UI allows selecting "Modern Minimal", "Bold Industrial", and "Elegant Luxury", but `StorefrontLayout.tsx` ignores the string.
2. **Hardcoded Home Fallbacks:** When a tenant hasn't configured custom home blocks, `StorefrontHomePage.tsx` falls back to hardcoded garment hero slides rather than generic industry-agnostic defaults.
3. **No Preview Mode for Drafts:** Updating CMS settings immediately mutates live storefront appearance without a draft/preview stage.
