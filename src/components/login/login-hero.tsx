"use client";

import { motion, type Variants, useReducedMotion } from "framer-motion";
import { Gauge, TrendingUp, Upload } from "lucide-react";

const FEATURES = [
  {
    icon: TrendingUp,
    title: "Live margin & ROI",
    description: "Every number recalculates the instant you change cost, fees, or FX rates.",
  },
  {
    icon: Upload,
    title: "Import in seconds",
    description: "Bring in your existing spreadsheet and get a governed pipeline back.",
  },
  {
    icon: Gauge,
    title: "Automatic verdicts",
    description: "Research, Shortlist, or Reject — scored against the bar you set.",
  },
];

const container: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.12, delayChildren: 0.1 } },
};

const item: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } },
};

export function LoginHero() {
  const reduceMotion = useReducedMotion();

  return (
    <div className="relative hidden h-full flex-col justify-center overflow-hidden bg-base px-16 lg:flex">
      {/* ambient background: grid + floating copper blobs, all built from
          existing design tokens (see .glass-panel / .float-slow in globals.css) */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            "linear-gradient(color-mix(in srgb, var(--color-ink) 100%, transparent) 1px, transparent 1px), linear-gradient(90deg, color-mix(in srgb, var(--color-ink) 100%, transparent) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
        }}
      />
      <div
        aria-hidden
        className={reduceMotion ? "absolute -top-32 -left-20 size-[420px] rounded-full opacity-40 blur-3xl" : "absolute -top-32 -left-20 size-[420px] rounded-full opacity-40 blur-3xl float-slow"}
        style={{
          background:
            "radial-gradient(circle, color-mix(in srgb, var(--color-copper) 55%, transparent), transparent 70%)",
        }}
      />
      <div
        aria-hidden
        className={reduceMotion ? "absolute top-1/3 -right-24 size-[380px] rounded-full opacity-30 blur-3xl" : "absolute top-1/3 -right-24 size-[380px] rounded-full opacity-30 blur-3xl float-slower"}
        style={{
          background:
            "radial-gradient(circle, color-mix(in srgb, var(--color-mahogany) 70%, transparent), transparent 70%)",
        }}
      />
      <div
        aria-hidden
        className={reduceMotion ? "absolute -bottom-40 left-1/4 size-[460px] rounded-full opacity-30 blur-3xl" : "absolute -bottom-40 left-1/4 size-[460px] rounded-full opacity-30 blur-3xl float-slow"}
        style={{
          background:
            "radial-gradient(circle, color-mix(in srgb, var(--color-copper-bright) 45%, transparent), transparent 70%)",
        }}
      />
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background: "radial-gradient(ellipse at center, transparent 40%, var(--color-base) 95%)",
        }}
      />

      <motion.div
        variants={reduceMotion ? undefined : container}
        initial={reduceMotion ? undefined : "hidden"}
        animate={reduceMotion ? undefined : "show"}
        className="relative z-10 max-w-md"
      >
        <motion.div variants={reduceMotion ? undefined : item} className="mb-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-lockup.png" alt="Jupitar Ecom" width={83} height={96} className="h-24 w-auto" />
        </motion.div>
        <motion.span
          variants={reduceMotion ? undefined : item}
          className="text-xs font-semibold tracking-[0.2em] text-copper-bright uppercase"
        >
          Product research, simplified
        </motion.span>
        <motion.h1
          variants={reduceMotion ? undefined : item}
          className="mt-4 font-display text-4xl leading-tight font-bold text-ink xl:text-[2.75rem]"
        >
          Know a winner{" "}
          <span className="bg-[linear-gradient(135deg,var(--color-copper),var(--color-copper-bright))] bg-clip-text text-transparent">
            before you list it.
          </span>
        </motion.h1>
        <motion.p variants={reduceMotion ? undefined : item} className="mt-5 text-base text-ink-dim">
          Import candidates, and watch margin, ROI, and verdict recalculate live as you edit cost,
          fees, and FX — no spreadsheet required.
        </motion.p>

        <div className="mt-12 flex flex-col gap-6">
          {FEATURES.map((feature) => (
            <motion.div key={feature.title} variants={reduceMotion ? undefined : item} className="flex gap-4">
              <div className="glass-panel flex size-10 shrink-0 items-center justify-center rounded-xl">
                <feature.icon className="size-4.5 text-copper-bright" />
              </div>
              <div>
                <p className="text-sm font-semibold text-ink">{feature.title}</p>
                <p className="mt-0.5 text-sm text-ink-faint">{feature.description}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
