import { type CSSProperties, type ClassList, component$ } from "@qwik.dev/core";

export interface NavItemProps {
  label: string;
  href: string;
  active: boolean;
  muted: boolean;
  danger?: boolean;
}

export default component$<NavItemProps & { class?: ClassList; style?: CSSProperties }>(
  ({ label, href, active, muted, danger = false, class: className, style, ...attributes }) => {
    return (
      <a
        href={href}
        class={[
          { active, "nav-item-muted": muted, "nav-item-danger text-danger": danger },
          className,
        ]}
        aria-current={active ? "page" : undefined}
        {...scopeAttributes(attributes)}
        style={style}
      >
        {label}
      </a>
    );
  },
);

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const key of Object.keys(props)) {
    if (key.startsWith("data-uf-")) scope[key] = "";
  }
  return scope;
}
