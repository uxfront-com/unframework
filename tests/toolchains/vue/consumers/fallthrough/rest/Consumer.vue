<script setup lang="ts">
import { ref, useTemplateRef } from "vue";

import Field from "../../../../../integration/cases/fallthrough/rest/__output__/vue/Field.vue";

const clicks = ref(0);
const field = useTemplateRef("field");

function focus() {
  field.value?.$el.focus();
}
</script>

<template>
  <p id="email-hint">Hint</p>
  <Field
    id="email"
    ref="field"
    label="Name"
    aria-describedby="email-hint"
    placeholder="Ada"
    @click="(event) => (clicks += event.detail)"
  />
  <button type="button" @click="focus">Focus</button>
</template>
