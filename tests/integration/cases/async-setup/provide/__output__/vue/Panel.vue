<script setup lang="ts">
import Badge, { ToneKey } from "./Badge.vue";
import { loadUser } from "./api";
import { provide } from "vue";

const { id } = defineProps<{ id: string }>();
defineSlots<{ default?(): unknown }>();

const user = await loadUser(id);

provide(ToneKey, "calm");
</script>

<template>
  <section class="panel" :aria-label="user.name">
    <Badge />
    <slot />
  </section>
</template>
