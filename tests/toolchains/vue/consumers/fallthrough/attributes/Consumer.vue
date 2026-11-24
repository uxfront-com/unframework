<script setup lang="ts">
import { ref, useTemplateRef } from "vue";

import SaveButton from "../../../../../integration/cases/fallthrough/attributes/__output__/vue/SaveButton.vue";

const pressed = ref(false);
const save = useTemplateRef("save");

function focus() {
  save.value?.$el.focus();
}
</script>

<template>
  <SaveButton
    id="save"
    ref="save"
    title="Save"
    aria-describedby="hint"
    :aria-pressed="pressed"
    @click="(event) => (pressed = !event.defaultPrevented)"
  />
  <button type="button" @click="focus">Focus</button>
</template>
