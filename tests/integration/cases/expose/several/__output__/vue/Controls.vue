<script setup lang="ts">
import Counter from "./Counter.vue";
import { useTemplateRef } from "vue";

const counter = useTemplateRef<{ increment(): void; reset(): void }>("counter");
</script>

<template>
  <div class="controls">
    <Counter ref="counter" :start="10" />
    <button type="button" @click="counter?.increment()">More</button>
    <button type="button" @click="counter?.reset()">Reset</button>
  </div>
</template>
