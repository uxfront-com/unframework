<script setup lang="ts">
import Badge, { ToneKey } from "./Badge.vue";
import { loadUser } from "./api";
import { onMounted, provide, useTemplateRef } from "vue";

const { id } = defineProps<{ id: string }>();
const emit = defineEmits<{ ready: [name: string] }>();

const user = await loadUser(id);
const input = useTemplateRef<HTMLInputElement>("input");

provide(ToneKey, "calm");

onMounted(() => {
  input.value?.focus();
  emit("ready", user.name);
});
</script>

<template>
  <form class="note" aria-label="Note">
    <label>Note for {{ user.name }} <input ref="input" type="text" /></label>
    <Badge />
  </form>
</template>
