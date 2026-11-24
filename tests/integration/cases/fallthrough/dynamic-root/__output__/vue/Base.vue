<script setup lang="ts">
import type { IntrinsicElementAttributes } from "vue";

const {
  href = undefined,
  disabled = undefined,
  text,
} = defineProps<
  { href?: string; disabled?: boolean; text: string } & /* @vue-ignore */ Omit<
    IntrinsicElementAttributes["a"] & IntrinsicElementAttributes["button"],
    "href" | "disabled" | "text" | "onPress"
  >
>();
const emit = defineEmits<{ press: [] }>();

function press(event: MouseEvent) {
  event.preventDefault();
  emit("press");
}
</script>

<template>
  <component
    :is="href ? 'a' : 'button'"
    :href="(href ? 'a' : 'button') === 'a' ? href : undefined"
    :disabled="(href ? 'a' : 'button') === 'button' ? disabled : undefined"
    class="base"
    style="padding: 4px 8px"
    @click="press"
  >{{ text }}</component>
</template>
