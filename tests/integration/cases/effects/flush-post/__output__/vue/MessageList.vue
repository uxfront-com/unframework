<script setup lang="ts">
import { shallowRef, useTemplateRef, watch } from "vue";

const emit = defineEmits<{ rendered: [count: number] }>();

const messages = shallowRef(["Welcome to the team"]);
const list = useTemplateRef<HTMLUListElement>("list");

watch(
  () => messages.value,
  () => {
    emit("rendered", list.value?.childElementCount ?? 0);
  },
  { flush: "post" },
);

function add() {
  messages.value = [...messages.value, `Message ${messages.value.length + 1}`];
}
</script>

<template>
  <section class="message-list" aria-label="Messages">
    <ul ref="list">
      <li v-for="message in messages" :key="message">{{ message }}</li>
    </ul>
    <button type="button" @click="add">Add a message</button>
  </section>
</template>
