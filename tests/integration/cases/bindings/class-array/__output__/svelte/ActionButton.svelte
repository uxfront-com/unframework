<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  export interface ActionButtonProps {
    label: string;
    size: "small" | "medium" | "large";
    primary: boolean;
    busy?: boolean;
    badge: number;
  }

  let { label, size, primary, busy = false, badge }: ActionButtonProps = $props();
</script>

<button
  type="button"
  class={["button", `button-${size}`, { "button-primary": primary, "is-busy": busy, "button-waiting": busy, "has-badge": badge }, primary ? "solid" : "outline"]}
>{label}</button>
