<script setup lang="ts">
import Picker from "./Picker.vue";
import { vMark } from "./vMark";
import { vTrace } from "./vTrace";
import { ref, shallowRef } from "vue";

const items = shallowRef([
  { id: "a", label: "Alpha" },
  { id: "b", label: "Beta" },
  { id: "c", label: "Gamma" },
]);

const prefix = ref("Open");
const focused = ref(0);
</script>

<template>
  <section class="menu" aria-label="Menu">
    <ul aria-label="Items">
      <li
        v-for="item in items"
        :key="item.id"
        v-trace="item.label"
        :data-name="item.id"
      >{{ item.label }}</li>
    </ul>
    <ul aria-label="Marked">
      <li
        v-for="item in items"
        :key="item.id"
        v-trace="item.label"
        v-mark="item.id"
        :data-name="`both-${item.id}`"
      >{{ item.label }}</li>
    </ul>
    <div class="focus">
      <button
        v-for="item in items"
        :key="item.id"
        v-trace="item.label"
        type="button"
        :data-name="`focus-${item.id}`"
        @focusin="focused++"
      >Focus {{ item.label }}</button>
    </div>
    <output>{{ focused }}</output>
    <ul aria-label="Prefixed">
      <li
        v-for="item in items"
        :key="item.id"
        v-trace="`${prefix} ${item.label}`"
        :data-name="`prefixed-${item.id}`"
      >{{ item.label }}</li>
    </ul>
    <Picker>
      <template #option="{ option }">
        <span v-trace="option.label" :data-name="`option-${option.id}`">{{ option.label }}</span>
      </template>
    </Picker>
    <button
      type="button"
      @click="items = items.map((item) =>
        item.id === 'a' ? { id: 'a', label: 'Alpha 2' } : item,
      )"
    >Rename first</button>
    <button type="button" @click="items = [...items].reverse()">Reverse</button>
    <button
      type="button"
      @click="items = items.filter((item) => item.id !== 'b')"
    >Remove second</button>
    <button type="button" @click="items = [...items, { id: 'd', label: 'Delta' }]">Add item</button>
    <button type="button" @click="prefix = 'Close'">Change prefix</button>
  </section>
</template>
