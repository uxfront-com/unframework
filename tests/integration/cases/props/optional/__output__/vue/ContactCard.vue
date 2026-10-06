<script setup lang="ts">
export interface ContactCardProps {
  name: string;
  jobTitle?: string;
  team?: string;
  pronouns?: string;
  phone?: string | null;
}

const {
  name,
  jobTitle = undefined,
  team = undefined,
  pronouns = undefined,
  phone = undefined,
} = defineProps<ContactCardProps>();
</script>

<template>
  <article class="contact-card" :aria-label="name" :data-team="team">
    <h2 :title="pronouns">{{ name }}</h2>
    <p>{{ jobTitle }}</p>
    <p>Phone: {{ phone ?? "not listed" }}</p>
  </article>
</template>
