<script lang="ts">
import type { InjectionKey } from "vue";

export interface Theme {
  accent: string;
  label: string;
}

export const ThemeKey: InjectionKey<Theme> = Symbol("uf.theme");
</script>

<script setup lang="ts">
import Badge from "./Badge.vue";
import { provide } from "vue";

provide(ThemeKey, { accent: "teal", label: "Teal" });
</script>

<template>
  <section aria-label="Themed">
    <Badge text="New" />
  </section>
</template>
