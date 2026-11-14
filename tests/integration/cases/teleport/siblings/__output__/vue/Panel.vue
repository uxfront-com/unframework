<script setup lang="ts">
import { onMounted, ref, shallowRef } from "vue";

interface Row {
  id: number;
  label: string;
}

const note = ref(false);
const extras = shallowRef<string[]>([]);

const rows = shallowRef<Row[]>([
  { id: 1, label: "Alpha" },
  { id: 2, label: "Beta" },
]);

function addExtra() {
  extras.value = [...extras.value, `Extra ${extras.value.length + 1}`];
}

const mounted = ref(false);

onMounted(() => {
  mounted.value = true;
});
</script>

<template>
  <section class="panel" aria-label="Panel">
    <button type="button" @click="note = true">Show note</button>
    <button type="button" @click="addExtra">Add extra</button>
    <button type="button" @click="rows = [...rows].reverse()">Reverse rows</button>
    <p v-if="note" class="note">Note</p>
    <span v-for="extra in extras" :key="extra">{{ extra }}</span>
    <Teleport v-if="mounted" to="body">
      <div data-teleported="true" class="first">First</div>
    </Teleport>
    <Teleport v-if="mounted" to="body">
      <div data-teleported="true" class="second">Second</div>
    </Teleport>
    <ul>
      <li
        v-for="row in rows"
        :key="row.id"
      >{{ row.label }}<Teleport
        v-if="mounted"
        to="body"
      ><p data-teleported="true" class="tip">{{ row.label }} tip</p></Teleport></li>
    </ul>
  </section>
</template>
