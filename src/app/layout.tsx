import type { Metadata } from "next";
import { Archivo, Inter } from "next/font/google";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { SettingsProvider } from "@/components/settings/settings-provider";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { getSettings } from "@/lib/settings";
import "./globals.css";

const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Jupitar Ecom",
  description: "Product research and pipeline tool for eBay dropshipping.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const settings = await getSettings();

  return (
    <html
      lang="en"
      className={`${archivo.variable} ${inter.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="h-full flex flex-col overflow-hidden bg-background text-foreground">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <NuqsAdapter>
            <TooltipProvider delayDuration={200}>
              <SettingsProvider initialSettings={settings}>
                {children}
                <Toaster />
              </SettingsProvider>
            </TooltipProvider>
          </NuqsAdapter>
        </ThemeProvider>
      </body>
    </html>
  );
}
