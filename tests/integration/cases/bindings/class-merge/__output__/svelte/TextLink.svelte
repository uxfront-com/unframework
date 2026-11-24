<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts" module>
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
</script>

<script lang="ts">
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<
    SvelteHTMLElements["p"],
    "href" | "label" | "strong" | "link" | "row" | "children" | "class" | "style" | "ref"
  > &
    TextLinkProps & { class?: ClassValue; style?: string; ref?: HTMLElementTagNameMap["p"] | null };

  let {
    href,
    label,
    strong,
    link,
    row,
    class: className,
    style,
    ref = $bindable(null),
    ...attributes
  }: Props = $props();
</script>

<p
  class={[row.class, "link-row", { "link-row-strong": strong }, className]}
  id={row.id}
  {style}
  bind:this={ref}
  {...attributes}
>
  <a {href} class={["text-link", link.class]} title={link.title} rel={link.rel}>{label}</a>
</p>
