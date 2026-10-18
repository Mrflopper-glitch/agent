import {
  ArrowLeftRight,
  ChartColumn,
  ChartPie,
  Crown,
  GraduationCap,
  House,
  LayoutGrid,
  Star,
  Trophy,
  Users,
  type LucideIcon,
} from "lucide-react";

/** Every page in the app, in sidebar order. Add a page here to put it in the menu. */
export const NAV_ITEMS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/", label: "Home", icon: House },
  { href: "/markets", label: "Markets", icon: ChartColumn },
  { href: "/trades", label: "Trades", icon: ArrowLeftRight },
  { href: "/traders", label: "Traders", icon: Crown },
  { href: "/watchlist", label: "Watchlist", icon: Star },
  { href: "/community", label: "Community", icon: Users },
  { href: "/portfolio", label: "Portfolio", icon: ChartPie },
  { href: "/learn", label: "Learn", icon: GraduationCap },
  { href: "/challenges", label: "Challenges", icon: Trophy },
  { href: "/tools", label: "Tools", icon: LayoutGrid },
];

/** The shortcuts in the top bar. */
export const TOP_LINKS = [
  { href: "/markets", label: "Markets" },
  { href: "/trades", label: "Trades" },
  { href: "/community", label: "Community" },
  { href: "/learn", label: "Learn" },
  { href: "/tools", label: "Tools" },
];

/** Is `href` the current page (or a parent of it)? */
export function isActive(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");
}
