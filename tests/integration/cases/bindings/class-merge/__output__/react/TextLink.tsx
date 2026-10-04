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

export default function TextLink({ href, label, strong, link, row }: TextLinkProps) {
  return (
    <p id={row.id} className={cx("link-row", { "link-row-strong": strong }, row.class)}>
      <a href={href} className={cx("text-link", link.class)} title={link.title} rel={link.rel}>
        {label}
      </a>
    </p>
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
