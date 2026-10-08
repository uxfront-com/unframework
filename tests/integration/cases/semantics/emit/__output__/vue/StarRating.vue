<script setup lang="ts">
import { ref } from "vue";

const emit = defineEmits<{
  preview: [stars: number];
  rate: [stars: number, previous: number];
  cleared: [];
}>();

const choices = [1, 2, 3, 4, 5];
const stars = ref(0);

function choose(next: number) {
  const previous = stars.value;
  emit("preview", next);
  stars.value = next;
  emit("rate", stars.value, previous);
}

function clear() {
  for (let star = stars.value - 1; star >= 0; star--) {
    emit("preview", star);
  }
  stars.value = 0;
  emit("cleared");
}
</script>

<template>
  <div class="star-rating" role="group" aria-label="Rating">
    <ul>
      <li v-for="choice in choices" :key="choice">
        <button
          type="button"
          :aria-pressed="stars >= choice"
          @click="choose(choice)"
        >{{ choice }} {{ choice === 1 ? "star" : "stars" }}</button>
      </li>
    </ul>
    <p role="status">{{ stars }} of 5</p>
    <button type="button" @click="clear">Clear</button>
  </div>
</template>
