import type { Metadata } from "next";
import { AlertTester } from "@/components/tools/alert-tester";
import { DiscordStatus } from "@/components/tools/discord-status";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = { title: "Tools" };

export default function ToolsPage() {
  return (
    <>
      <PageHeader title="Tools" subtitle="Connect your Discord and check how trade messages are read." />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_400px]">
        <AlertTester />
        <DiscordStatus />
      </div>
    </>
  );
}
