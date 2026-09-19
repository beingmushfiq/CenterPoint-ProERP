# 09 — Storefront SEO, AEO & GEO Architecture

**Status:** Completed  
**Date:** September 2026  
**Scope:** Per-Tenant Headless Search Discoverability & Machine Readability

---

## 1. Triple-Pillar Optimization: SEO, AEO & GEO

| Optimization Pillar | Target Consumers | Core Objective | Key Architectural Assets |
|---|---|---|---|
| **SEO** (Search Engine Optimization) | Googlebot, Bingbot, Yandex | Organic search ranking & indexation | Canonical URLs, title/meta tags, sitemaps (`sitemap.xml`), clean URL routing |
| **AEO** (Answer Engine Optimization) | ChatGPT Search, Perplexity, Claude, Google AI Overviews | Direct question answering & snippet extraction | FAQ schemas, structured specs, policy pages, concise product facts |
| **GEO** (Generative Engine Optimization) | Multimodal LLMs, Generative Search Engines | Authoritative brand context & entity mapping | Schema.org (`Organization`, `Product`, `Offer`), authoritative knowledge graph |

---

## 2. Hardcoded Assumptions Discovered in Audit

In `App\Modules\Ecommerce\Services\Seo\SeoMetadataService.php` (lines 32–36):
```php
'default_meta_title'       => $storefront?->name ?? $tenant?->name ?? 'Slice Mart',
'default_meta_description' => $storefront?->meta_description ?? 'Official multi-channel factory...',
'business_type'            => 'Organization',
'brand_name'               => $storefront?->name ?? $tenant?->name ?? 'Slice Mart',
'legal_name'               => $tenant?->name ?? 'Slice Mart Ltd.',
```

### Risk & Violation
If a new tenant (e.g. "Acme Garments") is created and their storefront metadata is queried before explicit custom configuration, the system serves **"Slice Mart"** and **"Slice Mart Ltd."** as their brand name and legal entity!  
**Remediation:** Remove all hardcoded "Slice Mart" fallbacks. The fallback MUST be dynamically derived from `$tenant->name` or fail cleanly.

---

## 3. Structured Data (JSON-LD) Implementations

The storefront provides structured JSON-LD schemas generated dynamically per tenant and product:

### 3.1 Organization & WebSite Schema
```json
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": "https://slicemart.tech/#organization",
      "name": "Slice Mart",
      "url": "https://slicemart.tech",
      "logo": "https://slicemart.tech/storage/tenants/1/branding/logo.png"
    },
    {
      "@type": "WebSite",
      "@id": "https://slicemart.tech/#website",
      "url": "https://slicemart.tech",
      "name": "Slice Mart Official Store",
      "potentialAction": {
        "@type": "SearchAction",
        "target": "https://slicemart.tech/catalog?q={search_term_string}",
        "query-input": "required name=search_term_string"
      }
    }
  ]
}
```

### 3.2 Product & Offer Schema
Every product detail view outputs standard schema with:
- Name, description, SKU, GTIN/barcode.
- Image URLs.
- Pricing (`price`, `priceCurrency`).
- Availability (`InStock`, `OutOfStock`).
- Return policy and delivery timeline references.

---

## 4. Crawlability & Rendering for Single Page Applications (SPA)

Because the storefront is built with **React 19 & Vite**, HTML served directly by the static web server contains an empty `<div id="root"></div>`.

### Crawlability Risk on Shared cPanel Hosting
While Googlebot can execute JavaScript, many social scrapers (Facebook Open Graph, Twitter Card crawler, WhatsApp link previews, LinkedIn) and AI answer crawlers (Perplexity, ChatGPT bot) do **NOT** execute client-side React bundles reliably.

### Recommended Solution: Server-Side Meta Injection
Rather than implementing heavy Node.js SSR on cPanel, implement a lightweight Laravel blade/HTML crawler gateway:
1. When a user requests `/products/{slug}` or `/`:
   - If the request is from a normal browser: Serve the Vite SPA index.html.
   - If the request is from a crawler (`bot`, `facebookexternalhit`, `twitterbot`, `googlebot`): Serve index.html with **pre-injected server-rendered `<meta>` tags and `<script type="application/ld+json">` blocks** using `SeoMetadataService`.
2. This achieves 100% crawlability and dynamic social link previews without the overhead of full SSR.
