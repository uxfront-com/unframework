<script setup lang="ts">
import Picker from "./Picker.vue";

interface Fruit {
  name: string;
  count: number;
}

const { fruits } = defineProps<{ fruits: Fruit[] }>();
</script>

<template>
  <Picker :items="fruits">
    <template #item="{ item }">
      <span>{{ item.name }} × {{ item.count }}</span>
    </template>
  </Picker>
</template>
