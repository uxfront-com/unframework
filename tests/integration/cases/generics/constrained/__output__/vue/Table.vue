<script setup lang="ts" generic="T extends { id: string; label: string }">
export interface TableProps<T extends { id: string; label: string }> {
  caption: string;
  rows: T[];
}

const { caption, rows } = defineProps<TableProps<T>>();
</script>

<template>
  <table>
    <caption>{{ caption }}</caption>
    <tbody>
      <tr v-for="row in rows" :key="row.id">
        <th scope="row">{{ row.id }}</th>
        <td>{{ row.label }}</td>
      </tr>
    </tbody>
  </table>
</template>
