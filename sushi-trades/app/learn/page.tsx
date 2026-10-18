import { GraduationCap } from "lucide-react";
import type { Metadata } from "next";
import { LearningPath } from "@/components/home/learning-path";
import { ComingSoon } from "@/components/ui/coming-soon";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = { title: "Learn" };

export default function LearnPage() {
  return (
    <>
      <PageHeader title="Learn" subtitle="Short lessons from the traders you follow." />
      <div className="space-y-4">
        <LearningPath index={0} />
        <ComingSoon icon={<GraduationCap />} title="Courses & guides" cta={{ label: "Practice in the simulator", href: "/portfolio" }}>
          Bite-sized lessons on options, chart reading and risk, taught with real calls from your Discord.
        </ComingSoon>
      </div>
    </>
  );
}
