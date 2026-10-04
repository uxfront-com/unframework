// UF3007 duplicate-attribute: `href` is written on the link and is also a key of its spread.
interface LinkAttributes {
  href: string;
  title?: string;
}

export interface NavLinkProps {
  label: string;
  link: LinkAttributes;
}

export default function NavLink({ label, link }: NavLinkProps) {
  return (
    <a href="/home" {...link}>
      {label}
    </a>
  );
}
