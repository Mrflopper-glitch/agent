import { Compass } from "lucide-react";
import { ComingSoon } from "@/components/ui/coming-soon";

export default function NotFound() {
  return (
    <div className="pt-10">
      <ComingSoon icon={<Compass />} title="Page not found" cta={{ label: "Back home", href: "/" }}>
        This page doesn&apos;t exist (yet).
      </ComingSoon>
    </div>
  );
}
