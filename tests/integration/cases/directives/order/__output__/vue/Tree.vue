<script setup lang="ts">
import Note from "./Note.vue";
import { type ObjectDirective, ref } from "vue";

const TRACE = "directive-trace";

const vTrace: ObjectDirective<HTMLElement, string> = {
  mounted(el, { value }) {
    document.dispatchEvent(new CustomEvent(TRACE, { detail: { call: `mounted ${value}`, el } }));
  },
  unmounted(el) {
    const call = `unmounted ${el.getAttribute("data-name")}`;
    document.dispatchEvent(new CustomEvent(TRACE, { detail: { call, el } }));
  },
};

const shown = ref(true);
</script>

<template>
  <section v-trace="'outer'" class="tree" aria-label="Tree" data-name="outer">
    <p v-trace="'first'" data-name="first">First</p>
    <Note />
    <div v-if="shown" v-trace="'branch'" class="branch" data-name="branch">
      <span v-trace="'leaf'" data-name="leaf">Leaf</span>
    </div>
    <p v-trace="'last'" data-name="last">Last</p>
    <button type="button" @click="shown = !shown">Toggle</button>
  </section>
</template>
