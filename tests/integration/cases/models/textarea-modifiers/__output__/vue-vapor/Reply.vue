<script setup vapor lang="ts">
import { type VaporDirective, ref, watchPostEffect } from "vue";

const message = ref("Thanks, see you soon");
const signature = ref("Ada");

const vTextCaret: VaporDirective<HTMLTextAreaElement> = (element) => {
  watchPostEffect(() => {
    const text = element.value;
    element.value = "";
    element.value = text;
  });
};
</script>

<template>
  <form aria-label="Reply">
    <textarea v-model.trim="message" v-text-caret aria-label="Message"></textarea>
    <textarea v-model.lazy="signature" v-text-caret aria-label="Signature"></textarea>
    <output>[{{ message }}] from {{ signature }}</output>
  </form>
</template>
