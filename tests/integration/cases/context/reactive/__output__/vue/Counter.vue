<script lang="ts">
import type { InjectionKey, Ref } from "vue";

export const CountKey: InjectionKey<Ref<number>> = Symbol("uf.count");
</script>

<script setup lang="ts">
import Display from "./Display.vue";
import { provide, ref } from "vue";

const count = ref(1);

provide(CountKey, count);
</script>

<template>
  <section aria-label="Counter">
    <Display />
    <button type="button" @click="count += 1">Add one</button>
  </section>
</template>
