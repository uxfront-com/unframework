<script setup lang="ts">
import { ref, shallowRef } from "vue";

const log = shallowRef<string[]>([]);
const resets = ref(0);

function record(line: string) {
  log.value = [...log.value, line];
}
</script>

<template>
  <section class="listener-order" aria-label="Listener order">
    <div class="toolbar" role="presentation" @click="record('toolbar')">
      <button type="button" @click="record('save')" @click.once="record('first save')">Save</button>
      <button type="button" @click.once="record('first send')" @click="record('send')">Send</button>
      <button type="button" @click="record('reset')" @click.once="resets += 1">Reset</button>
    </div>
    <div
      class="panel"
      role="presentation"
      @click.capture="record('panel capture')"
      @click.stop="record('panel bubble')"
    >
      <button type="button" @click="record('inside')">Inside</button>
    </div>
    <button type="button" @click="record('outside')">Outside</button>
    <div class="claim" role="presentation" @click.once="record('claim once')">
      <button type="button" @click.stop="record('stopped')">Stop</button>
      <button type="button" @click="record('pass')">Pass</button>
    </div>
    <div class="outer-zone" role="group" aria-label="Outer zone" @wheel="record('outer wheel')">
      <div
        class="inner-zone"
        role="group"
        aria-label="Inner zone"
        @wheel.passive="record('inner wheel')"
      >Scroll here</div>
    </div>
    <p>Resets: {{ resets }}</p>
    <ol aria-label="Log">
      <li v-for="(entry, index) in log" :key="index">{{ entry }}</li>
    </ol>
  </section>
</template>
