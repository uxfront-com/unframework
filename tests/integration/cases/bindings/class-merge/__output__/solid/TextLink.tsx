import { cx } from "./_unframework/cx";
import { type ComponentProps, type JSX, splitProps } from "solid-js";

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

export default function TextLink(
  props: TextLinkProps &
    Omit<ComponentProps<"p">, "href" | "label" | "strong" | "link" | "row" | "style"> & {
      style?: JSX.CSSProperties;
    },
) {
  const [, others] = splitProps(props, ["href", "label", "strong", "link", "row", "class"]);

  return (
    <p
      id={props.row.id}
      class={cx("link-row", { "link-row-strong": props.strong }, props.row.class, props.class)}
      {...others}
    >
      <a
        href={props.href}
        class={cx("text-link", props.link.class)}
        title={props.link.title}
        rel={props.link.rel}
      >
        {props.label}
      </a>
    </p>
  );
}
