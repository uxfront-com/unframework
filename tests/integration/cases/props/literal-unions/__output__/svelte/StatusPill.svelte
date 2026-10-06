<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  export interface StatusPillProps {
    status: "active" | "paused" | "archived";
    size?: "small" | "large";
    level?: 1 | 2 | 3;
  }

  let { status, size = "small", level = 1 }: StatusPillProps = $props();
</script>

<span
  class={["pill", `pill-${status}`, `pill-${size}`, `pill-level-${level}`]}
>{status === "active" ? "Active" : status === "paused" ? "Paused" : "Archived"}{level === 3 ? " (critical)" : ""}</span>
