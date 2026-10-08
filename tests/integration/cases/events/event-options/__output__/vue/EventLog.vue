<script setup lang="ts">
import { ref, shallowRef } from "vue";

const log = shallowRef<string[]>([]);
const volume = ref(5);

function record(line: string) {
  log.value = [...log.value, line];
}

function changeVolume(event: WheelEvent) {
  if (event.deltaY < 0) {
    volume.value += 1;
  } else {
    volume.value -= 1;
  }
}
</script>

<template>
  <section class="event-log" aria-label="Event options">
    <div
      class="panel"
      role="presentation"
      @click.capture="record('panel capture')"
      @click="record('panel bubble')"
    >
      <button type="button" @click="record('button')">Inside</button>
      <button type="button" @click.stop="record('stopped')">Stop here</button>
    </div>
    <button type="button" @click.once="record('once')">Only once</button>
    <div class="reward" role="presentation" @click="record('outer')">
      <button type="button" @click.stop.once="record('claimed')">Claim the reward</button>
    </div>
    <div class="volume" role="group" aria-label="Volume" @wheel.passive="changeVolume">
      <output>{{ volume }}</output>
    </div>
    <ol aria-label="Log">
      <li v-for="(entry, index) in log" :key="index">{{ entry }}</li>
    </ol>
  </section>
</template>
