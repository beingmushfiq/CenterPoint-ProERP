import React from 'react';
import { Truck, ShieldCheck, Award, MessageCircle, Clock, Zap, Star, CheckCircle } from 'lucide-react';
import type { PageBlock } from '../../../modules/storefront/StorefrontPageBuilderWorkspace';

interface ValuePropsBlockProps {
  block: PageBlock;
}

export const ValuePropsBlock: React.FC<ValuePropsBlockProps> = ({ block }) => {
  const title = block.title || 'The Quality Standard';
  const subtitle = block.subtitle || 'Our commitments to authentic quality, reliability, and service';
  const items = block.items || [
    { icon: 'shield', title: 'Direct Authenticity', desc: 'Manufactured and sourced directly with rigorous inspection.' },
    { icon: 'truck', title: 'Reliable Dispatch', desc: 'Carefully packaged and shipped directly with full order tracking.' },
    { icon: 'award', title: 'Official Guarantee', desc: 'Every order backed by comprehensive customer support and warranty.' },
    { icon: 'message', title: 'Dedicated Support', desc: 'Fast assistance for orders, bulk wholesale quotes, and concierge support.' },
  ];

  const getIcon = (iconName?: string) => {
    switch (iconName) {
      case 'truck':
        return <Truck className="size-5" />;
      case 'shield':
        return <ShieldCheck className="size-5" />;
      case 'award':
        return <Award className="size-5" />;
      case 'message':
        return <MessageCircle className="size-5" />;
      case 'clock':
        return <Clock className="size-5" />;
      case 'zap':
        return <Zap className="size-5" />;
      case 'star':
        return <Star className="size-5" />;
      default:
        return <CheckCircle className="size-5" />;
    }
  };

  return (
    <section className="space-y-6">
      {title && (
        <div className="text-center max-w-2xl mx-auto">
          <h2
            style={{ fontFamily: 'var(--store-font-heading, inherit)' }}
            className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100"
          >
            {title}
          </h2>
          {subtitle && (
            <p className="mt-1 text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">
              {subtitle}
            </p>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((item, idx) => (
          <div
            key={idx}
            className="flex flex-col p-6 rounded-2xl border border-zinc-200/90 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/50 shadow-2xs hover:shadow-md transition-all duration-300"
          >
            <div
              style={{
                backgroundColor: 'var(--store-primary-subtle, rgba(16,185,129,0.12))',
                color: 'var(--store-primary, #10b981)',
              }}
              className="flex size-11 items-center justify-center rounded-xl mb-4 shadow-2xs"
            >
              {getIcon(item.icon)}
            </div>
            <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
              {item.title}
            </h3>
            <p className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
              {item.desc}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
};
