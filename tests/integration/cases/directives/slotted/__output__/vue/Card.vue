<script setup lang="ts">
import Disclosure from "./Disclosure.vue";
import { type ObjectDirective, shallowRef } from "vue";

const vTrace: ObjectDirective<HTMLElement, string> = {
  mounted(el, { value }) {
    const call = `mounted ${value}`;
    document.dispatchEvent(new CustomEvent("directive-trace", { detail: { call, el } }));
  },
  unmounted(el) {
    const call = `unmounted ${el.getAttribute("data-name")}`;
    document.dispatchEvent(new CustomEvent("directive-trace", { detail: { call, el } }));
  },
};

const note = shallowRef<{ name: string } | null>({ name: "note" });
</script>

<template>
  <section class="card" aria-label="Card">
    <Disclosure>
      <p v-trace="'body'" data-name="body">Body</p>
      <p v-if="note" v-trace="note.name" data-name="note">Note</p>
    </Disclosure>
  </section>
</template>
