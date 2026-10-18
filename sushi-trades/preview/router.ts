import { useSyncExternalStore } from "react";

/**
 * A tiny hash router for the preview build: "#/traders/noahquant" is the
 * page /traders/noahquant. The real app uses Next.js routing instead.
 */

function currentPath(): string {
  const hash = window.location.hash.replace(/^#/, "");
  return hash.startsWith("/") ? hash : "/";
}

function subscribe(listener: () => void) {
  window.addEventListener("hashchange", listener);
  return () => window.removeEventListener("hashchange", listener);
}

export function usePath(): string {
  return useSyncExternalStore(subscribe, currentPath, () => "/");
}

export function navigate(href: string) {
  if (currentPath() !== href) window.location.hash = href;
}
