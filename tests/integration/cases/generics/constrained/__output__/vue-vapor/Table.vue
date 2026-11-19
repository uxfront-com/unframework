<script lang="ts">
export interface TableProps<T extends { id: string; label: string }> {
  caption: string;
  rows: T[];
}
</script>

<script setup vapor lang="ts" generic="T extends { id: string; label: string }">
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
