<script setup lang="ts">
const { label } = defineProps<{ label: string }>();
const slots = defineSlots<{ title?(): unknown; default?(): unknown }>();
</script>

<template>
  <section class="card" :aria-label="label">
    <header v-if="slots.title" class="title">
      <slot name="title" />
    </header>
    <div v-if="slots.default" class="body">
      <slot />
    </div>
    <p v-else>Empty card</p>
  </section>
</template>
