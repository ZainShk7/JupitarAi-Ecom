"use client";

import { useId, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Eye, EyeOff, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface FloatingInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "id"> {
  label: string;
  icon: LucideIcon;
  error?: string;
  isPassword?: boolean;
}

export function FloatingInput({
  label,
  icon: Icon,
  error,
  isPassword,
  type,
  className,
  ...props
}: FloatingInputProps) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  const resolvedType = isPassword ? (visible ? "text" : "password") : type;

  return (
    <div className="w-full">
      <div className="relative">
        <Icon
          aria-hidden
          className={cn(
            "pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-faint transition-colors duration-300 peer-focus:text-copper-bright",
            error && "text-bad-text",
          )}
        />
        <input
          id={id}
          type={resolvedType}
          placeholder=" "
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
          className={cn(
            "peer h-14 w-full rounded-xl border border-hairline bg-raised/50 pt-4 pr-3.5 pl-10 text-sm text-ink outline-none transition-all duration-300",
            "placeholder:text-transparent",
            "focus:border-copper focus:bg-raised focus:shadow-[0_0_0_4px_color-mix(in_srgb,var(--color-copper)_15%,transparent)]",
            error &&
              "border-bad focus:border-bad focus:shadow-[0_0_0_4px_color-mix(in_srgb,var(--color-bad)_18%,transparent)]",
            isPassword ? "pr-11" : "pr-3.5",
            className,
          )}
          {...props}
        />
        <label
          htmlFor={id}
          className={cn(
            "pointer-events-none absolute top-1/2 left-10 -translate-y-1/2 text-sm text-ink-faint transition-all duration-300",
            "peer-focus:top-4 peer-focus:translate-y-0 peer-focus:text-[11px] peer-focus:text-copper-bright",
            "peer-[&:not(:placeholder-shown)]:top-4 peer-[&:not(:placeholder-shown)]:translate-y-0 peer-[&:not(:placeholder-shown)]:text-[11px] peer-[&:not(:placeholder-shown)]:text-ink-dim",
          )}
        >
          {label}
        </label>
        {isPassword && (
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            tabIndex={-1}
            aria-label={visible ? "Hide password" : "Show password"}
            className="absolute top-1/2 right-3 -translate-y-1/2 text-ink-faint transition-colors hover:text-ink-dim"
          >
            {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        )}
      </div>
      <AnimatePresence>
        {error && (
          <motion.p
            id={`${id}-error`}
            role="alert"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.2 }}
            className="mt-1.5 pl-1 text-xs text-bad-text"
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
