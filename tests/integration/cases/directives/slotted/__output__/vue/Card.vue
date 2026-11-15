<script setup lang="ts">
import Disclosure from "./Disclosure.vue";
import type { ObjectDirective } from "vue";

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
</script>

<template>
  <section class="card" aria-label="Card">
    <Disclosure>
      <p v-trace="'body'" data-name="body">Body</p>
    </Disclosure>
  </section>
</template>
