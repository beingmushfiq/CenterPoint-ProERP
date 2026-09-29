import React from 'react';
import {
  Layers,
  Image as ImageIcon,
  Award,
  ShoppingBag,
  ListOrdered,
  Zap,
  HelpCircle,
  Mail,
  FileText,
  Code,
  Plus,
} from 'lucide-react';
import type { BlockType } from '../StorefrontPageBuilderWorkspace';

interface BlockPaletteSectionProps {
  onAddBlock: (type: BlockType) => void;
}

interface PaletteItem {
  type: BlockType;
  label: string;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
  colorClass: string;
}

const PALETTE_ITEMS: PaletteItem[] = [
  {
    type: 'hero_banner',
    label: 'Hero Banner Slider',
    desc: 'Multi-slide image carousel with CTA actions',
    icon: ImageIcon,
    colorClass: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
  },
  {
    type: 'value_props',
    label: 'Value Props',
    desc: 'Warranty, direct delivery, and service highlights',
    icon: Award,
    colorClass: 'text-purple-500 bg-purple-500/10 border-purple-500/20',
  },
  {
    type: 'trending_categories',
    label: 'Trending Categories',
    desc: 'Visual catalog category showcase cards',
    icon: Layers,
    colorClass: 'text-indigo-500 bg-indigo-500/10 border-indigo-500/20',
  },
  {
    type: 'featured_products',
    label: 'Featured Products',
    desc: 'Dynamic catalog grid with visual drag-order controls',
    icon: ShoppingBag,
    colorClass: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
  },
  {
    type: 'quality_journey',
    label: 'Quality Journey',
    desc: 'Engineering process and quality assurance steps',
    icon: ListOrdered,
    colorClass: 'text-blue-500 bg-blue-500/10 border-blue-500/20',
  },
  {
    type: 'promo_split_banner',
    label: 'Promo Split Banner',
    desc: 'High-contrast promotional announcement',
    icon: Zap,
    colorClass: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
  },
  {
    type: 'faq',
    label: 'FAQ Accordion',
    desc: 'Expandable frequently asked questions',
    icon: HelpCircle,
    colorClass: 'text-teal-500 bg-teal-500/10 border-teal-500/20',
  },
  {
    type: 'newsletter_vip',
    label: 'VIP Newsletter Club',
    desc: 'Subscriber lead capture and perk club sign-up',
    icon: Mail,
    colorClass: 'text-rose-500 bg-rose-500/10 border-rose-500/20',
  },
  {
    type: 'rich_text',
    label: 'Rich Text',
    desc: 'Editorial copy, headlines, and formatted story',
    icon: FileText,
    colorClass: 'text-zinc-500 bg-zinc-500/10 border-zinc-500/20',
  },
  {
    type: 'custom_html_css',
    label: 'Sandboxed Code',
    desc: 'Isolated custom HTML and CSS rendering',
    icon: Code,
    colorClass: 'text-cyan-500 bg-cyan-500/10 border-cyan-500/20',
  },
];

export const BlockPaletteSection: React.FC<BlockPaletteSectionProps> = ({ onAddBlock }) => {
  return (
    <div className="rounded-2xl border border-default bg-surface p-4 shadow-2xs space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-default flex items-center gap-1.5">
          <Layers className="h-4 w-4 text-primary" />
          <span>Add Section Block to Page</span>
        </span>
        <span className="text-[10px] text-muted hidden sm:inline">
          Click any block below to append to your live layout
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
        {PALETTE_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.type}
              type="button"
              onClick={() => onAddBlock(item.type)}
              className="flex items-center gap-2 rounded-xl border border-default bg-surface-sunken p-2.5 text-left hover:border-primary hover:bg-surface transition-all cursor-pointer group shadow-2xs"
              title={item.desc}
            >
              <div
                className={`size-7 rounded-lg flex items-center justify-center shrink-0 border ${item.colorClass} group-hover:scale-105 transition-transform`}
              >
                <Icon className="size-3.5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold text-default truncate group-hover:text-primary transition-colors">
                  {item.label}
                </div>
                <div className="text-[10px] text-muted truncate hidden sm:block">
                  {item.desc}
                </div>
              </div>
              <Plus className="size-3 text-muted group-hover:text-primary shrink-0 opacity-40 group-hover:opacity-100 transition-opacity" />
            </button>
          );
        })}
      </div>
    </div>
  );
};
