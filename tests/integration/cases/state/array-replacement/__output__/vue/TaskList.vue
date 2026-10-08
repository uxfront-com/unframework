<script setup lang="ts">
import { ref, shallowRef } from "vue";

export interface Task {
  id: string;
  label: string;
}

export interface TaskListProps {
  initial: Task[];
}

const { initial } = defineProps<TaskListProps>();

const tasks = shallowRef(initial);
const selected = ref<string>();
let added = 0;

function add() {
  added += 1;
  tasks.value = [...tasks.value, { id: `new-${added}`, label: `New task ${added}` }];
}

function select(id: string) {
  selected.value = id;
}

function remove(id: string) {
  tasks.value = tasks.value.filter((entry) => entry.id !== id);
}

function moveUp() {
  const index = tasks.value.findIndex((entry) => entry.id === selected.value);
  const above = tasks.value[index - 1];
  const current = tasks.value[index];
  if (index > 0 && above && current) {
    tasks.value = tasks.value.toSpliced(index - 1, 2, current, above);
  }
}
</script>

<template>
  <section class="task-list" aria-label="Tasks">
    <p v-if="tasks.length === 0">No tasks yet.</p>
    <ul v-else>
      <li v-for="task in tasks" :key="task.id">
        <button
          type="button"
          :aria-pressed="selected === task.id"
          @click="select(task.id)"
        >{{ task.label }}</button>
        <button
          type="button"
          :aria-label="`Remove ${task.label}`"
          @click="remove(task.id)"
        >Remove</button>
      </li>
    </ul>
    <button type="button" @click="add">Add task</button>
    <button type="button" @click="moveUp">Move up</button>
  </section>
</template>
