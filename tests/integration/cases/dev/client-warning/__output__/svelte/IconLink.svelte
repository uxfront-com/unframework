<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import { onMount } from "svelte";
  import type { ClassValue, HTMLAnchorAttributes } from "svelte/elements";

  type Props = Omit<
    HTMLAnchorAttributes,
    "href" | "label" | "children" | "class" | "style" | "ref"
  > & {
    href: string;
    label?: string;
    class?: ClassValue;
    style?: string;
    ref?: HTMLElementTagNameMap["a"] | null;
  };

  let {
    href,
    label,
    class: className,
    style,
    ref = $bindable(null),
    ...attributes
  }: Props = $props();

  let link: HTMLAnchorElement | null = null;

  onMount(() => {
    if (process.env.NODE_ENV !== "production") {
      const name = link?.getAttribute("aria-label") ?? link?.textContent?.trim();
      if (!name) console.warn("IconLink has no accessible name: give it a `label` or some text.");
    }
  });
</script>

<a
  bind:this={() => link, (element) => {
    link = element;
    ref = element;
  }}
  {href}
  aria-label={label}
  class={className}
  {style}
  {...attributes}
>
  <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
    <path d="M2 8h10M8 4l4 4-4 4" />
  </svg>
</a>
