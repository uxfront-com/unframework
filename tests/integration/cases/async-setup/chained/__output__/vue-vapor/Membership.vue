<script setup vapor lang="ts">
import { loadTeam, loadUser } from "./api";
import { computed } from "vue";

const { id } = defineProps<{ id: string }>();

const user = await loadUser(id);
const team = await loadTeam(user.teamId);
const summary = computed(() => `${user.name} is in ${team.name}`);
</script>

<template>
  <p class="membership" role="status">{{ summary }}</p>
</template>
