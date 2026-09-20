import React, { useEffect } from 'react';

export interface SeoMetaProps {
  title?: string | null | undefined;
  titleTemplate?: string | null | undefined;
  description?: string | null | undefined;
  canonical?: string | null | undefined;
  noIndex?: boolean | undefined;
  ogType?: 'website' | 'product' | 'article' | undefined;
  ogImage?: string | null | undefined;
  ogTitle?: string | null | undefined;
  ogDescription?: string | null | undefined;
  twitterCard?: 'summary' | 'summary_large_image' | undefined;
  twitterHandle?: string | null | undefined;
  schema?: Record<string, unknown> | Array<Record<string, unknown>> | null | undefined;
  brandName?: string | null | undefined;
  lang?: string | undefined;
  alternateLocales?: Array<{ hrefLang: string; href: string }> | undefined;
}

export const SeoHead: React.FC<SeoMetaProps> = ({
  title,
  titleTemplate,
  description,
  canonical,
  noIndex = false,
  ogType = 'website',
  ogImage,
  ogTitle,
  ogDescription,
  twitterCard = 'summary_large_image',
  twitterHandle,
  schema,
  brandName = 'Enterprise',
  lang = 'en',
  alternateLocales = [],
}) => {
  useEffect(() => {
    // 1. Format document title
    const activeBrand = (brandName || 'SliceMart Industries').trim();
    let finalTitle = activeBrand;

    if (title && title.trim()) {
      const cleanTitle = title.trim();
      if (cleanTitle === activeBrand || cleanTitle.toLowerCase() === activeBrand.toLowerCase()) {
        finalTitle = `${activeBrand} — ERP Operations`;
      } else if (titleTemplate) {
        finalTitle = titleTemplate.replace('{title}', cleanTitle).replace('{brand}', activeBrand);
      } else if (cleanTitle.includes(activeBrand)) {
        finalTitle = cleanTitle;
      } else {
        finalTitle = `${cleanTitle} | ${activeBrand}`;
      }
    } else {
      finalTitle = `${activeBrand} — ERP Operations`;
    }
    document.title = finalTitle;

    // Helper to set or create meta tag
    const setMetaTag = (attrName: 'name' | 'property', attrValue: string, content: string | undefined | null) => {
      if (content === undefined || content === null || content === '') {
        const existing = document.querySelector(`meta[${attrName}="${attrValue}"]`);
        if (existing) existing.remove();
        return;
      }
      let elem = document.querySelector(`meta[${attrName}="${attrValue}"]`);
      if (!elem) {
        elem = document.createElement('meta');
        elem.setAttribute(attrName, attrValue);
        document.head.appendChild(elem);
      }
      elem.setAttribute('content', content);
    };

    // Helper to set or create link tag
    const setLinkTag = (rel: string, href: string | undefined | null, extraAttrs: Record<string, string> = {}) => {
      const selector = `link[rel="${rel}"]` + Object.entries(extraAttrs).map(([k, v]) => `[${k}="${v}"]`).join('');
      let elem = document.querySelector(selector);
      if (href === undefined || href === null || href === '') {
        if (elem) elem.remove();
        return;
      }
      if (!elem) {
        elem = document.createElement('link');
        elem.setAttribute('rel', rel);
        Object.entries(extraAttrs).forEach(([k, v]) => elem?.setAttribute(k, v));
        document.head.appendChild(elem);
      }
      elem.setAttribute('href', href);
    };

    // 2. Meta Description
    setMetaTag('name', 'description', description || 'Official direct factory production and commercial storefront.');

    // 3. Robots directive
    const robotsDirective = noIndex
      ? 'noindex, nofollow, noarchive'
      : 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1';
    setMetaTag('name', 'robots', robotsDirective);

    // 4. Canonical URL
    const canonicalUrl = canonical || window.location.origin + window.location.pathname;
    setLinkTag('canonical', canonicalUrl);

    // 5. Open Graph Metadata
    setMetaTag('property', 'og:site_name', brandName);
    setMetaTag('property', 'og:type', ogType);
    setMetaTag('property', 'og:title', ogTitle || finalTitle);
    setMetaTag('property', 'og:description', ogDescription || description);
    setMetaTag('property', 'og:url', canonicalUrl);
    if (ogImage) {
      setMetaTag('property', 'og:image', ogImage);
    }

    // 6. Twitter Card Metadata
    setMetaTag('name', 'twitter:card', twitterCard);
    setMetaTag('name', 'twitter:title', ogTitle || finalTitle);
    setMetaTag('name', 'twitter:description', ogDescription || description);
    if (ogImage) {
      setMetaTag('name', 'twitter:image', ogImage);
    }
    if (twitterHandle) {
      setMetaTag('name', 'twitter:site', twitterHandle);
    }

    // 7. Alternate Locales / hreflang
    // Remove existing hreflang tags first
    document.querySelectorAll('link[rel="alternate"][hreflang]').forEach((el) => el.remove());
    alternateLocales.forEach((alt) => {
      setLinkTag('alternate', alt.href, { hreflang: alt.hrefLang });
    });

    // 8. Document Language
    document.documentElement.lang = lang;

    // 9. JSON-LD Structured Data Injection
    const existingSchemaScript = document.getElementById('erp-jsonld-schema');
    if (existingSchemaScript) {
      existingSchemaScript.remove();
    }

    if (schema) {
      const script = document.createElement('script');
      script.id = 'erp-jsonld-schema';
      script.type = 'application/ld+json';
      script.textContent = JSON.stringify(schema, null, 2);
      document.head.appendChild(script);
    }

    return () => {
      // Optional cleanup on unmount if needed
    };
  }, [
    title,
    titleTemplate,
    description,
    canonical,
    noIndex,
    ogType,
    ogImage,
    ogTitle,
    ogDescription,
    twitterCard,
    twitterHandle,
    schema,
    brandName,
    lang,
    alternateLocales,
  ]);

  return null;
};
