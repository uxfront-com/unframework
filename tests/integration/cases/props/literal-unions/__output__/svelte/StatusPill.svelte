<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts" module>
  export interface StatusPillProps {
    status: "active" | "paused" | "archived";
    size?: "small" | "large";
    level?: 1 | 2 | 3;
  }
</script>

<script lang="ts">
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<
    SvelteHTMLElements["span"],
    "status" | "size" | "level" | "children" | "class" | "style" | "ref"
  > &
    StatusPillProps & {
      class?: ClassValue;
      style?: string;
      ref?: HTMLElementTagNameMap["span"] | null;
    };

  let {
    status,
    size = "small",
    level = 1,
    class: className,
    style,
    ref = $bindable(null),
    ...attributes
  }: Props = $props();
</script>

<span
  class={["pill", `pill-${status}`, `pill-${size}`, `pill-level-${level}`, className]}
  {style}
  bind:this={ref}
  {...attributes}
>{status === "active" ? "Active" : status === "paused" ? "Paused" : "Archived"}{level === 3 ? " (critical)" : ""}</span>
