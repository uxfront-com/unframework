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
    >
      {label}
    </a>
  );
}

/** Joins class names, and the keys of an object's truthy entries, into one `className`. */
function cx(...parts: unknown[]): string {
  const names: string[] = [];
  for (const part of parts) {
    if (typeof part === "string") {
      if (part) names.push(part);
    } else if (part && typeof part === "object") {
      for (const [key, on] of Object.entries(part)) {
        if (on) names.push(key);
      }
    }
  }
  return names.join(" ");
}
