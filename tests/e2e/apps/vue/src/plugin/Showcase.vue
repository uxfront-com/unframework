<script setup lang="ts">
import Button from "@unframework/e2e-design-system/source/Button.uf.tsx";
import Card from "@unframework/e2e-design-system/source/Card.uf.tsx";
import Counter from "@unframework/e2e-design-system/source/Counter.uf.tsx";
import TextField from "@unframework/e2e-design-system/source/TextField.uf.tsx";
import { useToggle } from "@unframework/e2e-design-system/source/useToggle.uf.ts";
import { ref } from "vue";

import Greeting from "./Greeting.uf.tsx";

const presses = ref(0);
const name = ref("");
const { on, toggle } = useToggle(false);
</script>

<template>
  <main>
    <Greeting name="Vue" />
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
