<script setup lang="ts">
import { loadUser } from "./api";

const { id, prefix } = defineProps<{ id: string; prefix: string }>();

const user = await loadUser(prefix + id);
</script>

<template>
  <section class="greeting" aria-label="Greeting">
    <h2>Hello, {{ user.name }}</h2>
    <p>Signed in as {{ id }}</p>
  </section>
</template>
