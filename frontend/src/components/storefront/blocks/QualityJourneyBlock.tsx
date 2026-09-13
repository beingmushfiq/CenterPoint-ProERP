import React from 'react';
import { CheckCircle2, ShieldCheck } from 'lucide-react';
import type { PageBlock } from '../../../modules/storefront/StorefrontPageBuilderWorkspace';

interface QualityJourneyBlockProps {
  block: PageBlock;
}

export const QualityJourneyBlock: React.FC<QualityJourneyBlockProps> = ({ block }) => {
  const title = block.title || 'Precision Engineering & Verification';
  const subtitle =
    block.subtitle ||
    'From acoustic simulation to anechoic calibration, every hardware unit undergoes verified aerospace-grade inspection.';

  const defaultSteps = [
    {
      step: '01',
      title: 'Acoustic Simulation',
      desc: 'Finite element acoustic and thermal modeling ensuring sub-0.1dB harmonic resonance across 10Hz–45kHz.',
    },
    {
      step: '02',
      title: '5-Axis CNC Machining',
      desc: 'Solid blocks of aviation-grade 6063 alloy milled with diamond tooling and bead-blasted satin finish.',
    },
    {
      step: '03',
      title: 'Beryllium Assembly',
      desc: 'Ultra-thin pure beryllium foil diaphragms seated in Class-100 cleanroom environments.',
    },
    {
      step: '04',
      title: 'Anechoic Calibration',
      desc: 'Every transducer is serialized and frequency-matched to within ±0.4dB against reference standards.',
    },
    {
      step: '05',
      title: 'Stress & Aging Matrix',
      desc: '10,000-cycle hinge fatigue and 72-hour thermal stress testing prior to final tamper-evident sealing.',
    },
  ];

  const steps = (block.steps && block.steps.length > 0) ? block.steps : defaultSteps;

  return (
    <section className="rounded-3xl border border-zinc-200/90 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/50 p-6 sm:p-10 lg:p-12 shadow-xs space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-zinc-100 dark:border-zinc-800 pb-6">
        <div>
          <div className="inline-flex items-center gap-1.5 rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 text-[11px] font-semibold text-blue-600 dark:text-blue-400 mb-2">
            <ShieldCheck className="size-3.5" />
            <span className="font-mono uppercase tracking-wider">Quality Assurance Standard</span>
          </div>
          <h2
            style={{ fontFamily: 'var(--store-font-heading, inherit)' }}
            className="text-2xl sm:text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-100"
          >
            {title}
          </h2>
          {subtitle && (
            <p className="mt-1.5 text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 max-w-2xl leading-relaxed">
              {subtitle}
            </p>
          )}
        </div>

        <div className="hidden lg:flex items-center gap-2 text-xs font-mono text-zinc-400">
          <span>TOLERANCE: &plusmn;0.4dB</span>
          <span>•</span>
          <span>ISO-9001 VERIFIED</span>
        </div>
      </div>

      {/* Steps Grid with Progress Line */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 relative">
        {steps.map((st, i) => (
          <div
            key={i}
            className="group relative flex flex-col justify-between p-5 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-950/60 hover:border-zinc-300 dark:hover:border-zinc-700 transition-all duration-200 space-y-3 shadow-2xs hover:shadow-md"
          >
            <div className="flex items-center justify-between">
              <span className="flex size-7 items-center justify-center rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 font-mono text-xs font-black text-primary shadow-2xs">
                {st.step || `0${i + 1}`}
              </span>
              <CheckCircle2 className="size-4 text-emerald-500 opacity-80 group-hover:scale-110 transition-transform" />
            </div>

            <div className="space-y-1.5 pt-1">
              <h3 className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-zinc-100">
                {st.title}
              </h3>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
                {st.desc}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};
