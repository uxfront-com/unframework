<script lang="ts">
import type { InjectionKey } from "vue";

export const ThemeKey: InjectionKey<string> = Symbol("theme");
</script>

<template>
  <p>Theme</p>
</template>
