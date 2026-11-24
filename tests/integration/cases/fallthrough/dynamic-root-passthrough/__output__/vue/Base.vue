<script setup lang="ts">
import type { IntrinsicElementAttributes } from "vue";

const {
  href = undefined,
  disabled = undefined,
  text,
} = defineProps<
  { href?: string; disabled?: boolean; text: string } & /* @vue-ignore */ Omit<
    IntrinsicElementAttributes["a"] & IntrinsicElementAttributes["button"],
    "href" | "disabled" | "text"
  >
>();

function press(event: MouseEvent) {
  event.preventDefault();
}
</script>

<template>
  <component
    :is="href ? 'a' : 'button'"
    :href="(href ? 'a' : 'button') === 'a' ? href : undefined"
    :disabled="(href ? 'a' : 'button') === 'button' ? disabled : undefined"
    class="base"
    title="Base"
    @click="press"
  >{{ text }}</component>
</template>
