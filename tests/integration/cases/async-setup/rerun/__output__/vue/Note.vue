<script setup lang="ts">
import { loadUser } from "./api";
import { onMounted, useTemplateRef } from "vue";

const { id } = defineProps<{ id: string }>();
const emit = defineEmits<{ ready: [name: string] }>();

const user = await loadUser(id);
const input = useTemplateRef<HTMLInputElement>("input");

onMounted(() => {
  input.value?.focus();
  emit("ready", user.name);
});
</script>

<template>
  <form class="note" aria-label="Note">
    <label>Note for {{ user.name }} <input ref="input" type="text" /></label>
  </form>
</template>
