<script setup lang="ts">
export interface PlanProps {
  name: string;
  price: number;
  href: string;
  featured?: boolean;
  note?: string;
}

const { name, price, href, featured = false, note = undefined } = defineProps<PlanProps>();
</script>

<template>
  <article :class="featured ? 'plan featured' : 'plan'" :aria-label="name">
    <h2>{{ name }}</h2>
    <p>{{ price }} EUR a month</p>
    <p v-if="note" class="note">{{ note }}</p>
    <p v-else class="note">No commitment.</p>
    <a :href="href">Choose {{ name }}</a>
  </article>
</template>
