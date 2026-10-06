<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  export interface NavItemProps {
    label: string;
    href: string;
    active: boolean;
    muted: boolean;
    danger?: boolean;
  }

  let { label, href, active, muted, danger = false }: NavItemProps = $props();
</script>

<a
  {href}
  class={{ active, "nav-item-muted": muted, "nav-item-danger": danger, "text-danger": danger }}
  aria-current={active ? "page" : undefined}
>{label}</a>
