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
    <p {...row} class={["link-row", strong && "link-row-strong"]}>
      <a href={href} class="text-link" {...link}>
        {label}
      </a>
    </p>
  );
}
