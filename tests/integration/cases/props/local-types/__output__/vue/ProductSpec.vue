<script setup lang="ts">
type Availability = "in-stock" | "backorder" | "discontinued";

interface Finish {
  sku: string;
  label: string;
}

export interface ProductSpecProps {
  name: string;
  availability: Availability;
  size: { width: number; depth: number; unit: "cm" | "in" };
  finishes: Finish[];
}

const { name, availability, size, finishes } = defineProps<ProductSpecProps>();
</script>

<template>
  <section class="product-spec" :aria-label="name">
    <h2>{{ name }}</h2>
    <dl>
      <dt>Availability</dt>
      <dd>{{ availability }}</dd>
      <dt>Size</dt>
      <dd>{{ size.width }} × {{ size.depth }} {{ size.unit }}</dd>
    </dl>
    <ul>
      <li v-for="finish in finishes" :key="finish.sku">{{ finish.label }} ({{ finish.sku }})</li>
    </ul>
  </section>
</template>
