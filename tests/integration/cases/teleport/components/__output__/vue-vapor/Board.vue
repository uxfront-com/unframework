<script setup vapor lang="ts">
import Card from "./Card.vue";
import Tip from "./Tip.vue";
import { onMounted, ref, shallowRef } from "vue";

interface Row {
  id: number;
  label: string;
}

const rows = shallowRef<Row[]>([
  { id: 1, label: "Alpha" },
  { id: 2, label: "Beta" },
  { id: 3, label: "Gamma" },
]);

const late = ref(false);
const mounted = ref(false);

onMounted(() => {
  mounted.value = true;
});
</script>

<template>
  <section class="board" aria-label="Board">
    <button type="button" @click="rows = [...rows].reverse()">Reverse tips</button>
    <button type="button" @click="late = true">Show late</button>
    <Tip v-for="row in rows" :key="row.id" :label="row.label" />
    <template v-if="late">
      <Teleport v-if="mounted" to="body">
        <p data-teleported="true" class="tip" role="note">Late tip</p>
      </Teleport>
    </template>
    <Card>
      <Teleport v-if="mounted" to="body">
        <div data-teleported="true" class="slotted">Slotted</div>
      </Teleport>
    </Card>
  </section>
</template>
