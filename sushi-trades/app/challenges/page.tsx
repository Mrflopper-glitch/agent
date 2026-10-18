import { Trophy } from "lucide-react";
import type { Metadata } from "next";
import { ComingSoon } from "@/components/ui/coming-soon";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = { title: "Challenges" };

export default function ChallengesPage() {
  return (
    <>
      <PageHeader title="Challenges" subtitle="Compete with the community and grow." />
      <ComingSoon icon={<Trophy />} title="The 7-Figure Challenge" cta={{ label: "Start in the simulator", href: "/portfolio" }}>
        Everyone starts with $10,000. Pick your traders and your sizing. First to $1,000,000 wins.
      </ComingSoon>
    </>
  );
}
