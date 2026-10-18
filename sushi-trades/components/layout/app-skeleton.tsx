import Link from "next/link";
import { Logo } from "../brand/logo";

/** What shows for the split second before live data arrives: the page's shape, shimmering. */
export function AppSkeleton() {
  return (
    <>
      <header className="flex h-[72px] items-center gap-3 px-4 sm:px-6 lg:px-8">
        <Link href="/" className="text-ink lg:hidden" aria-label="Sushi Trades home">
          <Logo className="h-6" />
        </Link>
        <div className="skeleton hidden h-11 w-full max-w-[500px] sm:block" />
      </header>
      <div className="grid gap-4 px-4 pb-8 sm:px-6 lg:px-8 xl:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <div className="skeleton h-[250px]" />
          <div className="grid grid-cols-3 gap-3 md:grid-cols-6">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="skeleton h-[110px]" />
            ))}
          </div>
          <div className="skeleton h-[190px]" />
        </div>
        <div className="hidden space-y-4 xl:block">
          <div className="skeleton h-[250px]" />
          <div className="skeleton h-[250px]" />
        </div>
      </div>
    </>
  );
}
