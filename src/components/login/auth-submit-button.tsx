"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type SubmitState = "idle" | "loading" | "success";

export function AuthSubmitButton({
  state,
  children,
  className,
}: {
  state: SubmitState;
  children: React.ReactNode;
  className?: string;
}) {
  const reduceMotion = useReducedMotion();
  const idle = state === "idle";

  return (
    <motion.button
      type="submit"
      disabled={!idle}
      whileHover={idle && !reduceMotion ? { y: -2 } : undefined}
      whileTap={idle ? { scale: 0.98 } : undefined}
      transition={{ duration: 0.2 }}
      className={cn(
        "relative flex h-12 w-full items-center justify-center gap-1.5 rounded-xl text-sm font-semibold text-primary-foreground",
        "bg-[linear-gradient(135deg,var(--color-copper),var(--color-copper-bright))]",
        "shadow-[0_8px_24px_-8px_color-mix(in_srgb,var(--color-copper)_55%,transparent)]",
        "transition-shadow duration-300 hover:shadow-[0_14px_36px_-10px_color-mix(in_srgb,var(--color-copper)_70%,transparent)]",
        "focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
        "disabled:cursor-not-allowed",
        className,
      )}
    >
      <AnimatePresence mode="wait" initial={false}>
        {state === "idle" && (
          <motion.span
            key="idle"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="flex items-center gap-1.5"
          >
            {children}
          </motion.span>
        )}
        {state === "loading" && (
          <motion.span
            key="loading"
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.7 }}
            transition={{ duration: 0.15 }}
          >
            <Loader2 className="size-5 animate-spin" />
          </motion.span>
        )}
        {state === "success" && (
          <motion.span
            key="success"
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", stiffness: 400, damping: 15 }}
          >
            <Check className="size-5" />
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  );
}
