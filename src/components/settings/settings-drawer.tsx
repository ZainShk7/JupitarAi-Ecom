"use client";

import { Settings as SettingsIcon } from "lucide-react";
import { useSettings } from "@/components/settings/settings-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
} from "@/components/ui/sheet";
import { fromPence, toPence, type CurrencyCode } from "@/lib/money";

const FX_CURRENCIES: CurrencyCode[] = ["USD", "EUR", "PKR", "AUD"];

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-xs text-ink-dim">{label}</Label>
      {children}
      {hint ? <p className="text-[11px] text-ink-faint">{hint}</p> : null}
    </div>
  );
}

function numberInputProps(value: number, onCommit: (n: number) => void) {
  return {
    type: "number" as const,
    defaultValue: value,
    onBlur: (event: React.FocusEvent<HTMLInputElement>) => {
      const parsed = Number.parseFloat(event.target.value);
      if (Number.isFinite(parsed)) onCommit(parsed);
    },
    className: "h-8 tabular",
  };
}

export function SettingsDrawer() {
  const { settings, updateSetting } = useSettings();

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label="Settings">
          <SettingsIcon className="size-4" />
        </Button>
      </SheetTrigger>
      <SheetContent className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Settings</SheetTitle>
          <SheetDescription>
            Drives every calculation in the app — changes apply immediately.
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-5 px-4 pb-6">
          <Field label="eBay final value fee %" hint="Applied to every target price.">
            <Input
              {...numberInputProps(settings.ebayFeePercent, (n) =>
                updateSetting({ ebayFeePercent: n }),
              )}
              step="0.1"
            />
          </Field>

          <Field label="eBay fixed fee (£)" hint="Flat fee per order, on top of the % fee.">
            <Input
              {...numberInputProps(fromPence(settings.ebayFeeFixedPence), (n) =>
                updateSetting({ ebayFeeFixedPence: toPence(n) }),
              )}
              step="0.01"
            />
          </Field>

          <Field label="Promoted Listings ad rate %" hint="Set to 0 if you don't run ads.">
            <Input
              {...numberInputProps(settings.promotedAdPercent, (n) =>
                updateSetting({ promotedAdPercent: n }),
              )}
              step="0.1"
            />
          </Field>

          <Field label="Inbound shipping cost (£)" hint="Your cost to ship to the buyer, if not free.">
            <Input
              {...numberInputProps(fromPence(settings.inboundShippingPence), (n) =>
                updateSetting({ inboundShippingPence: toPence(n) }),
              )}
              step="0.01"
            />
          </Field>

          <Field label="VAT rate %" hint="Manual — never fetched or inferred.">
            <Input
              {...numberInputProps(settings.vatPercent, (n) => updateSetting({ vatPercent: n }))}
              step="0.1"
            />
          </Field>

          <div className="h-px bg-hairline" />

          <Field label="Minimum acceptable margin %" hint="Your bar — the verdict gauge's tick mark.">
            <Input
              {...numberInputProps(settings.minMarginPercent, (n) =>
                updateSetting({ minMarginPercent: n }),
              )}
              step="1"
            />
          </Field>

          <Field label="Maximum acceptable delivery (days)">
            <Input
              {...numberInputProps(settings.maxDeliveryDays, (n) =>
                updateSetting({ maxDeliveryDays: n }),
              )}
              step="1"
            />
          </Field>

          <div className="h-px bg-hairline" />

          <div className="flex flex-col gap-2">
            <Label className="text-xs text-ink-dim">FX rates (GBP per 1 unit)</Label>
            <div className="flex items-center gap-2">
              <span className="w-12 text-xs text-ink-faint">GBP</span>
              <Input value="1.00" disabled className="h-8 tabular" />
            </div>
            {FX_CURRENCIES.map((currency) => (
              <div key={currency} className="flex items-center gap-2">
                <span className="w-12 text-xs text-ink-faint">{currency}</span>
                <Input
                  {...numberInputProps(settings.fxRates[currency], (n) =>
                    updateSetting({ fxRates: { ...settings.fxRates, [currency]: n } }),
                  )}
                  step="0.0001"
                />
              </div>
            ))}
            <p className="text-[11px] text-ink-faint">
              These drift — update them as often as you need to trust the numbers.
            </p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
