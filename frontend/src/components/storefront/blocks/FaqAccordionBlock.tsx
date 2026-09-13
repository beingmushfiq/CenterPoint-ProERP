import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { PageBlock } from '../../../modules/storefront/StorefrontPageBuilderWorkspace';

interface FaqAccordionBlockProps {
  block: PageBlock;
}

export const FaqAccordionBlock: React.FC<FaqAccordionBlockProps> = ({ block }) => {
  const [openIdx, setOpenIdx] = useState<number | null>(0);
  const faqs = block.faqs || block.faqItems || [
    { q: 'How are orders fulfilled and dispatched?', a: 'All orders are processed through our central fulfillment line and dispatched with verifiable parcel tracking.' },
    { q: 'What payment methods do you accept?', a: 'We accept multiple secure payment options, including Cash on Delivery (where eligible), bank transfer, and online payments.' },
    { q: 'Do you support wholesale or commercial inquiries?', a: 'Yes! We support commercial, institutional, and bulk B2B orders with tiered volume pricing.' },
    { q: 'How can I track my shipment?', a: 'Visit the Track Order page at any time and enter your order tracking number or mobile number.' },
  ];

  const title = block.title || 'Frequently Asked Questions';
  const subtitle = block.subtitle || 'Quick answers to common questions about ordering, delivery, and policies';

  return (
    <section className="max-w-3xl mx-auto space-y-6">
      <div className="text-center space-y-1.5">
        <h2
          style={{ fontFamily: 'var(--store-font-heading, inherit)' }}
          className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100"
        >
          {title}
        </h2>
        {subtitle && (
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">
            {subtitle}
          </p>
        )}
      </div>

      <div className="space-y-3 pt-2">
        {faqs.map((faq, idx) => {
          const isOpen = openIdx === idx;
          return (
            <div
              key={idx}
              className="rounded-2xl border border-zinc-200/90 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/50 overflow-hidden shadow-2xs transition-colors"
            >
              <button
                type="button"
                onClick={() => setOpenIdx(isOpen ? null : idx)}
                className="flex w-full items-center justify-between p-4 sm:p-5 text-left text-xs sm:text-sm font-bold text-zinc-900 dark:text-zinc-100 cursor-pointer"
                aria-expanded={isOpen}
              >
                <span>{faq.q}</span>
                <ChevronDown
                  className={`size-4 shrink-0 text-zinc-400 transition-transform duration-200 ${
                    isOpen ? 'rotate-180 text-zinc-900 dark:text-zinc-100' : ''
                  }`}
                />
              </button>

              {isOpen && (
                <div className="px-4 pb-4 sm:px-5 sm:pb-5 text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed border-t border-zinc-100 dark:border-zinc-800/60 pt-3">
                  {faq.a}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
};
