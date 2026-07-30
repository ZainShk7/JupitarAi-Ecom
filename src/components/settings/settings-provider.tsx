"use client";

import { createContext, useContext, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { updateSettings } from "@/lib/actions";
import type { SettingsInput } from "@/lib/metrics";
import type { SettingsFieldsPatch } from "@/lib/settings-schema";

interface SettingsContextValue {
  settings: SettingsInput;
  updateSetting: (patch: SettingsFieldsPatch) => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

/**
 * Holds the live settings row client-side so every page can recompute
 * verdicts immediately when a setting changes — persistence to the server
 * is debounced and optimistic, matching the product-editing pattern.
 */
export function SettingsProvider({
  initialSettings,
  children,
}: {
  initialSettings: SettingsInput;
  children: ReactNode;
}) {
  const [settings, setSettings] = useState(initialSettings);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingPatch = useRef<SettingsFieldsPatch>({});
  const previousSnapshot = useRef<SettingsInput | null>(null);

  function updateSetting(patch: SettingsFieldsPatch) {
    if (!previousSnapshot.current) previousSnapshot.current = settings;
    setSettings((prev) => ({ ...prev, ...patch }));
    pendingPatch.current = { ...pendingPatch.current, ...patch };
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => void flush(), 400);
  }

  async function flush() {
    const patch = pendingPatch.current;
    pendingPatch.current = {};
    const snapshot = previousSnapshot.current;
    previousSnapshot.current = null;
    if (Object.keys(patch).length === 0) return;

    const result = await updateSettings(patch);
    if (!result.ok) {
      toast.error(`Couldn't save settings: ${result.error}`);
      if (snapshot) setSettings(snapshot);
    }
  }

  return (
    <SettingsContext.Provider value={{ settings, updateSetting }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used within a SettingsProvider");
  return ctx;
}
