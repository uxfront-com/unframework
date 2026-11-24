import { cx } from "./_unframework/cx";
import { scopeAttributes } from "./_unframework/scopeAttributes";
import type { CSSProperties } from "react";

export interface NavItemProps {
  label: string;
  href: string;
  active: boolean;
  muted: boolean;
  danger?: boolean;
}

export interface NavItemAttributes {
  className?: string;
  style?: CSSProperties;
}

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
      {...scopeAttributes(attributes)}
    >
      {label}
    </a>
  );
}
