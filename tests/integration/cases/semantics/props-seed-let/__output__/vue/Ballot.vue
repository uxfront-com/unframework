<script setup lang="ts">
import { ref, watch, watchPostEffect } from "vue";

export interface BallotProps {
  limit: number;
  label?: string;
  choices: string[];
}

const { limit, label = "Vote", choices } = defineProps<BallotProps>();
const emit = defineEmits<{
  voted: [remaining: number, text: string];
  moved: [line: string];
  report: [text: string];
  counted: [answers: number];
}>();

const votes = ref(limit);
const picked = ref("none");
let remaining = limit;
let text = `${label} (${limit})`;
let lastVotes = votes.value;

function isAnswer(value: string): value is "yes" | "no" {
  return value === "yes" || value === "no";
}

function describe(): string {
  const line = `${picked.value} with ${votes.value} left`;
  return line;
}

watchPostEffect(() => {
  emit("report", describe());
});

watch([votes, picked], ([nextVotes, nextPicked]: [number, string], [lastCount, lastPick]) => {
  emit("moved", `${lastPick}:${lastCount}>${nextPicked}:${nextVotes}`);
});

function vote(choice: string) {
  if (remaining > 0) remaining -= 1;
  text = `${text}!`;
  lastVotes = votes.value;
  votes.value -= 1;
  picked.value = isAnswer(choice) ? choice : "other";
  emit("voted", remaining, `${text} ${lastVotes}`);
}

function count() {
  let answers = 0;
  choices.forEach((choice) => isAnswer(choice) && answers++);
  emit("counted", answers);
}
</script>

<template>
  <section class="ballot" :aria-label="label">
    <p role="status">{{ votes }} votes left</p>
    <p>Picked: {{ picked }}</p>
    <ul aria-label="Choices">
      <li v-for="choice in choices" :key="choice">
        <button type="button" @click="vote(choice)">{{ choice }}</button>
      </li>
    </ul>
    <button type="button" @click="count">Count the answers</button>
  </section>
</template>
