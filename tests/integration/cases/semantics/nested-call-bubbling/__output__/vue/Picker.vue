<script setup lang="ts">
import { nextTick, ref, shallowRef } from "vue";

const emit = defineEmits<{ done: [step: number, status: string] }>();

const selected = ref("none");
const hits = ref(0);
const log = shallowRef<string[]>([]);
const status = ref("idle");
const step = ref(0);

function record(line: string) {
  log.value = [...log.value, line];
}

function pick(name: string) {
  selected.value = name;
  hits.value += 1;
}

function report() {
  record(`picked ${selected.value} #${hits.value}`);
}

async function load() {
  status.value = "loading";
  await Promise.resolve();
  step.value += 1;
}

async function run() {
  step.value += 1;
  await load();
  status.value = `loaded ${step.value}`;
  await nextTick();
  emit("done", step.value, status.value);
}

function start() {
  void run();
  status.value = "started";
}
</script>

<template>
  <section class="picker" aria-label="Picker">
    <div class="choices" role="presentation" @click="report">
      <button type="button" @click="pick('alpha')">Alpha</button>
      <button type="button" @click="pick('beta')">Beta</button>
    </div>
    <ol aria-label="Log">
      <li v-for="(entry, index) in log" :key="index">{{ entry }}</li>
    </ol>
    <p role="status">{{ status }}</p>
    <button type="button" @click="start">Start</button>
  </section>
</template>
