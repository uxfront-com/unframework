import { type CSSProperties, type ClassList, type PropsOf, component$ } from "@qwik.dev/core";

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

export default component$<
  TextLinkProps &
    Omit<PropsOf<"p">, "href" | "label" | "strong" | "link" | "row" | "class" | "style"> & {
      class?: ClassList;
      style?: CSSProperties;
    }
>(({ href, label, strong, link, row, class: className, style, ...attributes }) => {
  return (
    <p
      id={row.id}
      class={["link-row", { "link-row-strong": strong }, row.class, className]}
      style={style}
      {...attributes}
    >
      <a href={href} class={["text-link", link.class]} title={link.title} rel={link.rel}>
        {label}
      </a>
    </p>
  );
});
