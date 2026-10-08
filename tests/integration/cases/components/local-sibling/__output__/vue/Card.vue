<script setup lang="ts">
import CardIcon from "./CardIcon.vue";

const { title } = defineProps<{ title: string }>();
</script>

<template>
  <div class="card">
    <CardIcon symbol="+" />
    <h3>{{ title }}</h3>
    <CardIcon symbol="-" />
  </div>
</template>
