import { navigate, usePath } from "../router";

/** Stands in for next/navigation in the preview build. */

export function usePathname(): string {
  return usePath();
}

export function useRouter() {
  return { push: navigate, replace: navigate, back: () => history.back(), forward: () => history.forward(), refresh: () => {}, prefetch: () => {} };
}

export function useParams(): Record<string, string> {
  return {};
}
