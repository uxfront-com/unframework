<script lang="ts">
import type { InjectionKey } from "vue";

export const DepthKey: InjectionKey<number> = Symbol("uf.depth");
</script>

<script setup lang="ts">
import { inject, provide } from "vue";

const { title } = defineProps<{ title: string }>();
defineSlots<{ default?(): unknown }>();

const depth = inject(DepthKey, 0);

provide(DepthKey, depth + 1);
</script>

<template>
  <section :aria-label="title">
    <h2>{{ title }} at depth {{ depth }}</h2>
    <slot />
  </section>
</template>
