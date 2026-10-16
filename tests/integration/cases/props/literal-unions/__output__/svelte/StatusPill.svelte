<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { ClassValue } from "svelte/elements";

  export interface StatusPillProps {
    status: "active" | "paused" | "archived";
    size?: "small" | "large";
    level?: 1 | 2 | 3;
  }

  type Props = StatusPillProps & { class?: ClassValue; style?: string };

  let { status, size = "small", level = 1, class: className, style }: Props = $props();
</script>

<span
  class={["pill", `pill-${status}`, `pill-${size}`, `pill-level-${level}`, className]}
  {style}
>{status === "active" ? "Active" : status === "paused" ? "Paused" : "Archived"}{level === 3 ? " (critical)" : ""}</span>
