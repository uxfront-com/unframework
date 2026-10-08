<script setup lang="ts">
import Field from "../../../../../integration/cases/fallthrough/inherit-attrs-false/__output__/vue/Field.vue";
</script>

<template>
  <!-- @uf-expect TS2322 Field.prop:label -->
  <Field :label="1" />
</template>
