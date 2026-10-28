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
  import type { ClassValue } from "svelte/elements";

  type Props = TextLinkProps & { class?: ClassValue; style?: string };

  let { href, label, strong, link, row, class: className, style, ...attributes }: Props = $props();

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }
</script>

<p
  class={[row.class, "link-row", { "link-row-strong": strong }, className]}
  id={row.id}
  {style}
  {...scopeAttributes(attributes)}
>
  <a {href} class={["text-link", link.class]} title={link.title} rel={link.rel}>{label}</a>
</p>
