<script lang="ts">
import type { InjectionKey } from "vue";

export const LocaleKey: InjectionKey<string> = Symbol("uf.locale");
</script>

<script setup lang="ts">
import { provide } from "vue";

const { locale } = defineProps<{ locale: string }>();
defineSlots<{ default?(): unknown }>();

provide(LocaleKey, locale);
</script>

<template>
  <div :lang="locale">
    <slot />
  </div>
</template>
