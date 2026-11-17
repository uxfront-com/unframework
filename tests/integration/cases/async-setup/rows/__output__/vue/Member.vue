<script setup lang="ts">
import { loadUser } from "./api";

const { id } = defineProps<{ id: string }>();

const user = await loadUser(id);
</script>

<template>
  <li class="member">{{ user.name }}</li>
</template>
