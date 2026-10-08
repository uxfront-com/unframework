<script setup lang="ts">
import Card from "./Card.vue";
</script>

<template>
  <div class="cards">
    <Card label="Full">
      <template #default>
        <p>Sunny, 21°</p>
      </template>
      <template #title>
        <h3>Weather</h3>
      </template>
    </Card>
    <Card label="Bare" />
  </div>
</template>
