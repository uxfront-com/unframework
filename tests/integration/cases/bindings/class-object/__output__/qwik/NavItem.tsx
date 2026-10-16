import { type CSSProperties, type ClassList, component$ } from "@qwik.dev/core";

export interface NavItemProps {
  label: string;
  href: string;
  active: boolean;
  muted: boolean;
  danger?: boolean;
}

export default component$<NavItemProps & { class?: ClassList; style?: CSSProperties }>(
  ({ label, href, active, muted, danger = false, class: className, style }) => {
    return (
      <a
        href={href}
        class={[
          { active, "nav-item-muted": muted, "nav-item-danger text-danger": danger },
          className,
        ]}
        aria-current={active ? "page" : undefined}
        style={style}
      >
        {label}
      </a>
    );
  },
);
