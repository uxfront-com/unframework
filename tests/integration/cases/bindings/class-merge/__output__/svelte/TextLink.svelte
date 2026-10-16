<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { ClassValue } from "svelte/elements";

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

  type Props = TextLinkProps & { class?: ClassValue; style?: string };

  let { href, label, strong, link, row, class: className, style }: Props = $props();
</script>

<p class={[row.class, "link-row", { "link-row-strong": strong }, className]} id={row.id} {style}>
  <a {href} class={["text-link", link.class]} title={link.title} rel={link.rel}>{label}</a>
</p>
