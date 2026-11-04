<script setup lang="ts">
import TextField from "../../../../../integration/cases/types/utility-types/__output__/vue/TextField.vue";
</script>

<template>
  <!-- @uf-expect TS2322 TextField.prop:placeholder -->
  <TextField name="email" label="Email" :placeholder="1" />
</template>
