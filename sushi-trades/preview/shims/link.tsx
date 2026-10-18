import { forwardRef, type AnchorHTMLAttributes } from "react";

/** Stands in for next/link in the preview build: internal links become "#/path". */
type Props = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & { href: string; prefetch?: boolean };

const Link = forwardRef<HTMLAnchorElement, Props>(function Link({ href, prefetch, ...rest }, ref) {
  void prefetch;
  const external = /^[a-z]+:/i.test(href);
  return (
    <a
      ref={ref}
      href={external ? href : `#${href}`}
      target={external ? "_blank" : undefined}
      rel={external ? "noreferrer" : undefined}
      {...rest}
    />
  );
});

export default Link;
