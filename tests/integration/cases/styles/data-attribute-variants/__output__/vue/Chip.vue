<script setup lang="ts">
const {
  label,
  variant = "neutral",
  pressed = false,
} = defineProps<{ label: string; variant?: "neutral" | "danger"; pressed?: boolean }>();
</script>

<template>
  <button
    type="button"
    class="chip"
    :data-variant="variant"
    :data-state="pressed ? 'on' : 'off'"
    :aria-pressed="pressed ? 'true' : 'false'"
    data-uf-69db3802=""
  >{{ label }}</button>
</template>

<style src="./Chip.uf.tsx.css"></style>
