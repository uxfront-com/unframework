import { type CSSProperties, type ClassList, component$ } from "@qwik.dev/core";

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

export default component$<TextLinkProps & { class?: ClassList; style?: CSSProperties }>(
  ({ href, label, strong, link, row, class: className, style, ...attributes }) => {
    return (
      <p
        id={row.id}
        class={["link-row", { "link-row-strong": strong }, row.class, className]}
        {...scopeAttributes(attributes)}
        style={style}
      >
        <a href={href} class={["text-link", link.class]} title={link.title} rel={link.rel}>
          {label}
        </a>
      </p>
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
