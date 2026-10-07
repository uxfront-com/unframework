<script setup lang="ts">
import { ref } from "vue";

const emit = defineEmits<{ liked: [liked: boolean, by: string] }>();

const text = ref("");
const liked = ref(false);

function autosize(event: Event) {
  const area = event.currentTarget as HTMLTextAreaElement;
  text.value = area.value;
  area.style.height = `${Math.max(area.value.split("\n").length, 2) * 1.5}em`;
}

function toggleLike(event: MouseEvent | KeyboardEvent) {
  liked.value = !liked.value;
  emit("liked", liked.value, event.type);
}

function onLikeKeydown(event: KeyboardEvent) {
  if (event.key === " ") event.preventDefault();
  if (event.key === "Enter" || event.key === " ") toggleLike(event);
}
</script>

<template>
  <section class="comment-card" aria-label="Comment">
    <label>Comment<textarea name="comment" rows="2" @input="autosize"></textarea></label>
    <div class="meter" role="presentation">
      <div class="fill" :style="{ width: `${Math.min(text.length, 100)}%` }"></div>
    </div>
    <p>{{ text.length }} characters</p>
    <div
      class="like"
      role="button"
      tabindex="0"
      :aria-pressed="liked"
      @click="toggleLike"
      @keydown="onLikeKeydown"
    >Like</div>
  </section>
</template>
