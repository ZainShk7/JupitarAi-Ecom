"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SourcingPanel } from "@/components/sourcing/sourcing-panel";

export function SourcingTabs() {
  return (
    <Tabs defaultValue="aliexpress" className="flex min-h-0 flex-1 flex-col p-4">
      <TabsList className="w-fit">
        <TabsTrigger value="aliexpress">AliExpress</TabsTrigger>
        <TabsTrigger value="ebay">eBay</TabsTrigger>
      </TabsList>
      <TabsContent value="aliexpress" className="flex min-h-0 flex-1 flex-col">
        <SourcingPanel provider="aliexpress" />
      </TabsContent>
      <TabsContent value="ebay" className="flex min-h-0 flex-1 flex-col">
        <SourcingPanel provider="ebay" />
      </TabsContent>
    </Tabs>
  );
}
