<script setup lang="ts">
import { nextTick, ref, useTemplateRef } from "vue";

const emit = defineEmits<{ toggled: [items: number] }>();

const open = ref(false);
const details = useTemplateRef<HTMLUListElement>("details");

async function toggle() {
  open.value = !open.value;
  await nextTick();
  emit("toggled", details.value?.childElementCount ?? 0);
}
</script>

<template>
  <section class="shipping-details" aria-label="Shipping">
    <button type="button" :aria-expanded="open" @click="toggle">Shipping details</button>
    <ul v-if="open" ref="details">
      <li>Ships in two days</li>
      <li>Free returns</li>
      <li>Tracked delivery</li>
    </ul>
  </section>
</template>
