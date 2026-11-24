<script setup lang="ts">
import SaveAction from "./SaveAction.vue";
import { computed, ref, useTemplateRef } from "vue";

const clicks = ref(0);

const saveComponent = useTemplateRef<{ $el: HTMLButtonElement }>("saveComponent");
const save = computed(() => saveComponent.value?.$el ?? null);
</script>

<template>
  <div role="toolbar" aria-label="Actions">
    <SaveAction
      id="save"
      ref="saveComponent"
      text="Save"
      aria-label="Save draft"
      @click="() => clicks++"
    />
    <button type="button" @click="save?.focus()">Focus save</button>
    <p>Clicks: {{ clicks }}</p>
  </div>
</template>
