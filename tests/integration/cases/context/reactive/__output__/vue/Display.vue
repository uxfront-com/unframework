<script setup lang="ts">
import { CountKey } from "./Counter.vue";
import { inject, ref } from "vue";

const none = ref(0);
const count = inject(CountKey, none);
</script>

<template>
  <output>Count: {{ count }}</output>
</template>
