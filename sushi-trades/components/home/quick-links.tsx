"use client";

import { motion } from "motion/react";
import { BookOpen, ChartColumn, Crown, Lightbulb, Trophy, Users } from "lucide-react";
import Link from "next/link";
import { appear } from "../ui/motion";

const LINKS = [
  { href: "/markets", label: "Live Markets", note: "Real-time data", icon: ChartColumn },
  { href: "/traders", label: "Pro Trades", note: "Follow top traders", icon: Crown },
  { href: "/trades", label: "Ideas", note: "Trade setups", icon: Lightbulb },
  { href: "/learn", label: "Learning", note: "Courses & guides", icon: BookOpen },
  { href: "/community", label: "Community", note: "Discuss & share", icon: Users },
  { href: "/challenges", label: "Challenges", note: "Compete & grow", icon: Trophy },
];

/** The row of six shortcut tiles under the banner. They lift a little on hover. */
export function QuickLinks() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6">
      {LINKS.map(({ href, label, note, icon: Icon }, i) => (
        <motion.div key={href} {...appear(i + 1)}>
          <Link
            href={href}
            className="group flex h-full flex-col items-center rounded-2xl border border-line bg-surface px-2 py-4 text-center shadow-card transition-all duration-300 hover:-translate-y-1 hover:border-brand/30 hover:shadow-lift"
          >
            <Icon className="size-8 text-brand transition-transform duration-300 group-hover:scale-110" strokeWidth={1.6} />
            <span className="mt-2.5 text-sm font-semibold">{label}</span>
            <span className="mt-0.5 text-xs text-muted">{note}</span>
          </Link>
        </motion.div>
      ))}
    </div>
  );
}
