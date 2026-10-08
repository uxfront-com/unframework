<script setup lang="ts">
import Row from "./Row.vue";
import { shallowRef } from "vue";

export interface Task {
  id: number;
  name: string;
  done: boolean;
}

const { initial } = defineProps<{ initial: Task[] }>();

const tasks = shallowRef(initial);

function add() {
  tasks.value = [...tasks.value, { id: tasks.value.length + 1, name: "Water plants", done: false }];
}

function finish(id: number) {
  tasks.value = tasks.value.map((task) => (task.id === id ? { ...task, done: true } : task));
}
</script>

<template>
  <div>
    <div role="list" aria-label="Tasks">
      <Row v-for="task in tasks" :key="task.id" :name="task.name" :done="task.done" />
    </div>
    <button type="button" @click="add">Add a task</button>
    <button type="button" @click="finish(1)">Finish the first</button>
  </div>
</template>
