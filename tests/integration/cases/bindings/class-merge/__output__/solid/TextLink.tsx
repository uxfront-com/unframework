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

export default function TextLink(props: TextLinkProps) {
  return (
    <p
      id={props.row.id}
      class={cx("link-row", { "link-row-strong": props.strong }, props.row.class)}
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

/** Joins class names: strings as they are, and the names of an object's truthy entries. */
function cx(...parts: unknown[]): string {
  const names: string[] = [];
  for (const part of parts) {
    if (typeof part === "string") names.push(part);
    else if (part && typeof part === "object") {
      for (const [name, on] of Object.entries(part)) if (on) names.push(name);
    }
  }
  return names.join(" ");
}
