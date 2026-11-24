import { cx } from "./_unframework/cx";
import type { ComponentPropsWithRef } from "react";

interface LinkAttributes {
  class?: string;
  title?: string;
  rel?: string;
}

interface RowAttributes {
  class: string;
  id?: string;
}

export interface TextLinkProps {
  href: string;
  label: string;
  strong: boolean;
  link: LinkAttributes;
  row: RowAttributes;
}

export type TextLinkAttributes = Omit<
  ComponentPropsWithRef<"p">,
  "href" | "label" | "strong" | "link" | "row" | "children"
>;

export default function TextLink({
  href,
  label,
  strong,
  link,
  row,
  className,
  style,
  ...attributes
}: TextLinkProps & TextLinkAttributes) {
  return (
    <p
      id={row.id}
      className={cx("link-row", { "link-row-strong": strong }, className, row.class)}
      style={style}
      {...attributes}
    >
      <a href={href} className={cx("text-link", link.class)} title={link.title} rel={link.rel}>
        {label}
      </a>
    </p>
  );
}
