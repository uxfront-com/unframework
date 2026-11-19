<script lang="ts">
import type { InjectionKey } from "vue";

export const ToneKey: InjectionKey<string> = Symbol("uf.tone");
</script>

<script setup vapor lang="ts">
import { inject } from "vue";

const tone = inject(ToneKey, "plain");
</script>

<template>
  <span class="badge">Tone: {{ tone }}</span>
</template>
