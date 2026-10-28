<script setup lang="ts">
import Form from "../../../../../integration/cases/types/child-type-import/__output__/vue/Form.vue";
</script>

<template>
  <!-- @uf-expect TS2741 Form.prop:field -->
  <Form :field="{ name: 'email' }" />
</template>
