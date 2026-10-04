export interface NavItemProps {
  label: string;
  href: string;
  active: boolean;
  muted: boolean;
  danger?: boolean;
}

export default function NavItem({ label, href, active, muted, danger = false }: NavItemProps) {
  return (
    <a
      href={href}
      class={{ active, "nav-item-muted": muted, "nav-item-danger text-danger": danger }}
      aria-current={active ? "page" : undefined}
    >
      {label}
    </a>
  );
}
