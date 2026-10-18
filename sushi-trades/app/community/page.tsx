import type { Metadata } from "next";
import { CommunityView } from "@/components/community/community-view";

export const metadata: Metadata = { title: "Community" };

export default function CommunityPage() {
  return <CommunityView />;
}
