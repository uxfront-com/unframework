<script setup lang="ts">
import Base from "./Base.vue";
import Primary from "./Primary.vue";
import { ref, shallowRef, toRef, useTemplateRef } from "vue";

const linked = ref(true);
const log = shallowRef<string[]>([]);

const directComponent = useTemplateRef<{ $el: HTMLAnchorElement | HTMLButtonElement }>(
  "directComponent",
);
const direct = toRef(() => directComponent.value?.$el ?? null);

const chainedComponent = useTemplateRef<{ $el: HTMLAnchorElement | HTMLButtonElement }>(
  "chainedComponent",
);
const chained = toRef(() => chainedComponent.value?.$el ?? null);

function record(line: string) {
  log.value = [...log.value, line];
}
</script>

<template>
  <section aria-label="Page">
    <Base
      id="direct"
      ref="directComponent"
      :href="linked ? '#direct' : undefined"
      text="Direct"
      aria-label="Direct"
      data-testid="direct"
      title="Go"
      @click="(event) => record(`click on ${(event.currentTarget as Element).localName}`)"
      @keydown="(event) => record(`keydown ${event.key} on ${(event.currentTarget as Element).localName}`)"
    />
    <Primary
      id="chained"
      ref="chainedComponent"
      :href="linked ? '#chained' : undefined"
      text="Chained"
      aria-label="Chained"
      data-testid="chained"
      @click="(event) => record(`chained on ${(event.currentTarget as Element).localName}`)"
    />
    <button type="button" @click="linked = !linked">Toggle</button>
    <button type="button" @click="direct?.focus()">Focus direct</button>
    <button type="button" @click="chained?.focus()">Focus chained</button>
    <ol aria-label="Log">
      <li v-for="(entry, index) in log" :key="index">{{ entry }}</li>
    </ol>
  </section>
</template>
