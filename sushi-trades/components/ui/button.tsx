import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

const VARIANTS = {
  primary: "bg-brand-bright text-ink shadow-[0_6px_16px_-6px_rgb(0_194_90/0.6)] hover:brightness-95",
  secondary: "border border-line bg-surface text-ink hover:bg-track",
  ghost: "text-muted hover:bg-track hover:text-ink",
  dark: "bg-ink text-white hover:bg-ink/85",
} as const;

const SIZES = {
  sm: "h-8 px-3 text-[13px] rounded-lg",
  md: "h-10 px-4 text-sm rounded-xl",
  lg: "h-12 px-6 text-[15px] rounded-xl",
} as const;

interface Props {
  variant?: keyof typeof VARIANTS;
  size?: keyof typeof SIZES;
  className?: string;
  children: ReactNode;
}

function classes({ variant = "primary", size = "md", className }: Omit<Props, "children">) {
  return cn(
    "inline-flex items-center justify-center gap-2 font-semibold transition-all active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50",
    VARIANTS[variant],
    SIZES[size],
    className,
  );
}

export function Button({ variant, size, className, ...rest }: Props & ComponentProps<"button">) {
  return <button className={classes({ variant, size, className })} {...rest} />;
}

export function ButtonLink({ variant, size, className, ...rest }: Props & ComponentProps<typeof Link>) {
  return <Link className={classes({ variant, size, className })} {...rest} />;
}
