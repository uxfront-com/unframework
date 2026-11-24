import { cx } from "./_unframework/cx";
import type { ComponentPropsWithRef } from "react";

export interface NavItemProps {
  label: string;
  href: string;
  active: boolean;
  muted: boolean;
  danger?: boolean;
}

export type NavItemAttributes = Omit<
  ComponentPropsWithRef<"a">,
  "label" | "href" | "active" | "muted" | "danger" | "children"
>;

export default function NavItem({
  label,
  href,
  active,
  muted,
  danger = false,
  className,
  style,
  ...attributes
}: NavItemProps & NavItemAttributes) {
  return (
    <a
      href={href}
      className={cx(
        { active, "nav-item-muted": muted, "nav-item-danger": danger, "text-danger": danger },
        className,
      )}
      aria-current={active ? "page" : undefined}
      style={style}
      {...attributes}
    >
      {label}
    </a>
  );
}
