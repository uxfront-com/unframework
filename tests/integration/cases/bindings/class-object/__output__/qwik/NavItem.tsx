import { component$ } from "@qwik.dev/core";

export interface NavItemProps {
  label: string;
  href: string;
  active: boolean;
  muted: boolean;
  danger?: boolean;
}

export default component$<NavItemProps>(({ label, href, active, muted, danger = false }) => {
  return (
    <a
      href={href}
      class={{ active, "nav-item-muted": muted, "nav-item-danger text-danger": danger }}
      aria-current={active ? "page" : undefined}
    >
      {label}
    </a>
  );
});
