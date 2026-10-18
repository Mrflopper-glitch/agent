"use client";

import { motion } from "motion/react";
import type { ReactNode } from "react";
import { ButtonLink } from "./button";
import { Card } from "./card";

/**
 * A friendly placeholder for sections that are on the way.
 * `icon` is an element, e.g. icon={<Trophy />}, so pages rendered on the server can pass it in.
 */
export function ComingSoon({ icon, title, children, cta }: { icon: ReactNode; title: string; children: ReactNode; cta?: { label: string; href: string } }) {
  return (
    <Card className="mx-auto max-w-xl px-6 py-12 text-center">
      <motion.span
        initial={{ scale: 0.6, rotate: -12, opacity: 0 }}
        animate={{ scale: 1, rotate: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 16, delay: 0.1 }}
        className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-brand-soft text-up [&_svg]:size-8 [&_svg]:stroke-[1.7]"
      >
        {icon}
      </motion.span>
      <p className="mt-5 text-[11px] font-bold tracking-widest text-up uppercase">Coming soon</p>
      <h2 className="mt-1 text-2xl font-extrabold tracking-tight">{title}</h2>
      <p className="mx-auto mt-2 max-w-sm text-sm text-muted">{children}</p>
      {cta && (
        <ButtonLink href={cta.href} className="mt-6">
          {cta.label}
        </ButtonLink>
      )}
    </Card>
  );
}
