<script setup lang="ts">
import { ref } from "vue";

const started = ref(false);
const suggesting = ref(false);
const accepted = ref(0);

function accept(event: KeyboardEvent) {
  event.preventDefault();
  suggesting.value = false;
  accepted.value += 1;
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === "Enter") event.preventDefault();
  started.value = true;
}

function onKeydown_1(event: KeyboardEvent) {
  if (suggesting.value && event.key === "Enter") accept(event);
}
</script>

<template>
  <section class="reply-box" aria-label="Reply">
    <label>Message<textarea name="message" @keydown.once="onKeydown"></textarea></label>
    <p>{{ started ? "Started" : "Not started" }}</p>
    <label>Answer<textarea name="answer" @keydown="onKeydown_1"></textarea></label>
    <button
      type="button"
      :aria-pressed="suggesting"
      @click="suggesting = !suggesting"
    >Suggestions</button>
    <p>Accepted: {{ accepted }}</p>
  </section>
</template>
