<script setup lang="ts">
import { formatDistance } from "./format";
import type { Unit } from "./units";
import { shallowRef } from "vue";

const { value } = defineProps<{ value: number }>();

const unit = shallowRef<Unit>("km");
</script>

<template>
  <section class="distance" aria-label="Distance">
    <p role="status">{{ formatDistance(value, unit) }}</p>
    <button type="button" @click="unit = unit === 'km' ? 'mi' : 'km'">Switch units</button>
  </section>
</template>
