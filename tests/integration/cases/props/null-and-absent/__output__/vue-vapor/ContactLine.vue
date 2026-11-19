<script lang="ts">
export interface ContactLineProps {
  name: string;
  phone?: string | null;
  verified?: boolean | null;
}
</script>

<script setup vapor lang="ts">
const { name, phone = undefined, verified = undefined } = defineProps<ContactLineProps>();
</script>

<template>
  <section class="contact-line" :aria-label="name">
    <p
      :data-phone="phone === null ? 'withheld' : phone"
    >Phone: {{ phone === null ? "withheld" : (phone ?? "not given yet") }}</p>
    <p>{{ verified === null ? "Verification pending" : verified ? "Verified" : "Not verified" }}</p>
  </section>
</template>
