<script setup lang="ts">
const { from } = defineProps<{ from: number }>();
defineOptions({ name: "Countdown" });
</script>

<template>
  <div class="level">
    <span>{{ from }}</span>
    <Countdown v-if="from > 0" :from="from - 1" />
    <strong v-else>Liftoff</strong>
  </div>
</template>
