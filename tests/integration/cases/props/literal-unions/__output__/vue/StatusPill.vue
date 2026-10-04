<script setup lang="ts">
export interface StatusPillProps {
  status: "active" | "paused" | "archived";
  size?: "small" | "large";
  level?: 1 | 2 | 3;
}

const { status, size = "small", level = 1 } = defineProps<StatusPillProps>();
</script>

<template>
  <span
    class="pill"
    :class="[`pill-${status}`, `pill-${size}`, `pill-level-${level}`]"
  >{{ status === "active" ? "Active" : status === "paused" ? "Paused" : "Archived" }}{{ level === 3 ? " (critical)" : "" }}</span>
</template>
