<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
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

  let { href, label, strong, link, row }: TextLinkProps = $props();
</script>

<p class={[row.class, "link-row", { "link-row-strong": strong }]} id={row.id}>
  <a {href} class={["text-link", link.class]} title={link.title} rel={link.rel}>{label}</a>
</p>
