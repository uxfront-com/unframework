<script lang="ts">
export interface ActionButtonProps {
  label: string;
  size: "small" | "medium" | "large";
  primary: boolean;
  busy?: boolean;
  badge: number;
}
</script>

<script setup vapor lang="ts">
const { label, size, primary, busy = false, badge } = defineProps<ActionButtonProps>();
</script>

<template>
  <button
    type="button"
    class="button"
    :class="[`button-${size}`, { 'button-primary': primary, 'is-busy': busy, 'button-waiting': busy, 'has-badge': badge }, primary ? 'solid' : 'outline']"
  >{{ label }}</button>
</template>
