<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { ClassValue } from "svelte/elements";

  export interface ActionButtonProps {
    label: string;
    size: "small" | "medium" | "large";
    primary: boolean;
    busy?: boolean;
    badge: number;
  }

  type Props = ActionButtonProps & { class?: ClassValue; style?: string };

  let { label, size, primary, busy = false, badge, class: className, style }: Props = $props();
</script>

<button
  type="button"
  class={["button", `button-${size}`, { "button-primary": primary, "is-busy": busy, "button-waiting": busy, "has-badge": badge }, primary ? "solid" : "outline", className]}
  {style}
>{label}</button>
