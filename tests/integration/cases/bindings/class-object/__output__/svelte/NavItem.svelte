<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts" module>
  export interface NavItemProps {
    label: string;
    href: string;
    active: boolean;
    muted: boolean;
    danger?: boolean;
  }
</script>

<script lang="ts">
  import type { ClassValue, HTMLAnchorAttributes } from "svelte/elements";

  type Props = Omit<
    HTMLAnchorAttributes,
    "label" | "href" | "active" | "muted" | "danger" | "children" | "class" | "style" | "ref"
  > &
    NavItemProps & { class?: ClassValue; style?: string; ref?: HTMLElementTagNameMap["a"] | null };

  let {
    label,
    href,
    active,
    muted,
    danger = false,
    class: className,
    style,
    ref = $bindable(null),
    ...attributes
  }: Props = $props();
</script>

<a
  {href}
  class={[{ active, "nav-item-muted": muted, "nav-item-danger": danger, "text-danger": danger }, className]}
  aria-current={active ? "page" : undefined}
  {style}
  bind:this={ref}
  {...attributes}
>{label}</a>
