<script setup lang="ts">
const { level } = defineProps<{ level: number }>();
defineOptions({ name: "KeepAliveComponent" });
</script>

<template>
  <div class="level">
    <span>Level {{ level }}</span>
    <KeepAliveComponent v-if="level > 0" :level="level - 1" />
  </div>
</template>
