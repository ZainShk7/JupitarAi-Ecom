"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

export type MoveDirection = "next" | "prev" | "down";

/** Click-to-edit input: Enter commits + moves down, Tab commits + moves next
 *  (Shift+Tab moves prev), Escape cancels without committing. Blur also
 *  commits, so clicking away never silently discards an edit. */
export function EditableInput({
  defaultValue,
  type = "text",
  align = "left",
  list,
  onCommit,
  onCancel,
  onNavigate,
  onLiveChange,
}: {
  defaultValue: string;
  type?: "text" | "number";
  align?: "left" | "right";
  list?: string;
  onCommit: (value: string) => void;
  onCancel: () => void;
  onNavigate: (direction: MoveDirection) => void;
  onLiveChange?: (value: string) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const committedRef = useRef(false);

  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);

  function commitOnce() {
    if (committedRef.current) return;
    committedRef.current = true;
    onCommit(ref.current?.value ?? "");
  }

  return (
    <input
      ref={ref}
      type={type}
      step={type === "number" ? "any" : undefined}
      list={list}
      defaultValue={defaultValue}
      onChange={(event) => onLiveChange?.(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          committedRef.current = true; // suppress the blur-commit that follows
          onCancel();
          return;
        }
        if (event.key === "Enter") {
          event.preventDefault();
          commitOnce();
          onNavigate("down");
          return;
        }
        if (event.key === "Tab") {
          event.preventDefault();
          commitOnce();
          onNavigate(event.shiftKey ? "prev" : "next");
        }
      }}
      onBlur={commitOnce}
      className={cn(
        "tabular h-full w-full bg-transparent px-2 text-sm outline-none ring-2 ring-inset ring-copper",
        align === "right" && "text-right",
      )}
    />
  );
}

export function EditableSelect<T extends string>({
  value,
  options,
  labelFor,
  onCommit,
}: {
  value: T;
  options: readonly T[];
  labelFor: (option: T) => string;
  onCommit: (value: T) => void;
}) {
  const ref = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    ref.current?.focus();
  }, []);

  return (
    <select
      ref={ref}
      defaultValue={value}
      onChange={(event) => onCommit(event.target.value as T)}
      className="h-full w-full bg-raised px-2 text-sm outline-none ring-2 ring-inset ring-copper"
    >
      {options.map((option) => (
        <option key={option} value={option}>
          {labelFor(option)}
        </option>
      ))}
    </select>
  );
}
