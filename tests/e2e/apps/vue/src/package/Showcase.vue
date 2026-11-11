<script setup lang="ts">
import { Button, Card, Counter, TextField, useToggle } from "@unframework.dev/e2e-design-system/vue";
import { ref } from "vue";

const presses = ref(0);
const name = ref("");
const { on, toggle } = useToggle(false);
</script>

<template>
  <main>
    <Button @press="presses += 1">Press me</Button>
    <p>Presses: {{ presses }}</p>
    <Counter :initial="2" :step="3" />
    <TextField v-model:value="name" label="Name" />
    <p>Name: {{ name }}</p>
    <Card>
      <template #header><h2>Card header</h2></template>
      <button type="button" @click="toggle">Toggle card</button>
      <template #footer>
        <p>{{ on ? "Open" : "Closed" }}</p>
      </template>
    </Card>
  </main>
</template>
