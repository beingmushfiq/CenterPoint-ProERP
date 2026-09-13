import React, { useState } from 'react';
import { Mail, Check } from 'lucide-react';
import type { PageBlock } from '../../../modules/storefront/StorefrontPageBuilderWorkspace';
import { notify } from '../../ui/Toast';

interface NewsletterVipBlockProps {
  block: PageBlock;
}

export const NewsletterVipBlock: React.FC<NewsletterVipBlockProps> = ({ block }) => {
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);

  const title = block.title || 'Stay Connected';
  const subtitle =
    block.subtitle ||
    'Subscribe for advance access to new product releases, seasonal offerings, and subscriber-only updates.';
  const buttonText = block.button_text || 'Subscribe';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes('@')) {
      notify.error('Please provide a valid email address.');
      return;
    }
    setSubscribed(true);
    notify.success('Thank you for subscribing! We will keep you updated.');
  };

  return (
    <section className="rounded-3xl border border-zinc-200/90 dark:border-zinc-800/80 bg-zinc-50 dark:bg-zinc-900/40 p-8 sm:p-12 text-center max-w-3xl mx-auto shadow-xs">
      <div className="flex size-12 items-center justify-center rounded-2xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 mx-auto mb-4 shadow-sm">
        <Mail className="size-5" />
      </div>

      <h2
        style={{ fontFamily: 'var(--store-font-heading, inherit)' }}
        className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100"
      >
        {title}
      </h2>

      <p className="mt-2 text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 max-w-md mx-auto">
        {subtitle}
      </p>

      {subscribed ? (
        <div className="mt-6 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-bold">
          <Check className="size-4" />
          <span>You have successfully subscribed to our newsletter.</span>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-6 flex flex-col sm:flex-row gap-2 max-w-md mx-auto">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email address..."
            required
            className="flex-1 px-4 py-2.5 text-xs rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-400 shadow-2xs"
          />
          <button
            type="submit"
            style={{
              backgroundColor: 'var(--store-primary, #10b981)',
              color: 'var(--store-primary-fg, #ffffff)',
            }}
            className="px-5 py-2.5 rounded-xl font-bold text-xs shadow-sm transition-transform active:scale-95 cursor-pointer hover:opacity-90"
          >
            {buttonText}
          </button>
        </form>
      )}

      <p className="mt-3 text-[11px] text-zinc-400">
        We respect your privacy. Unsubscribe at any time with one click.
      </p>
    </section>
  );
};
