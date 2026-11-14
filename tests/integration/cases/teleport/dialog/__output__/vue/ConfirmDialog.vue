<script setup lang="ts">
import { onMounted, useId, useTemplateRef } from "vue";

export interface ConfirmDialogProps {
  title: string;
}

const { title } = defineProps<ConfirmDialogProps>();
const emit = defineEmits<{ confirm: []; close: [] }>();

const titleId = `uf-id-${useId()}`;
const cancel = useTemplateRef<HTMLButtonElement>("cancel");

onMounted(() => {
  cancel.value?.focus();
});

function onKeydown(event: KeyboardEvent) {
  if (event.key === "Escape") emit("close");
}
</script>

<template>
  <div
    role="dialog"
    aria-modal="true"
    :aria-labelledby="titleId"
    tabindex="-1"
    class="dialog"
    @keydown="onKeydown"
  >
    <h2 :id="titleId">{{ title }}</h2>
    <button ref="cancel" type="button" @click="emit('close')">Cancel</button>
    <button type="button" @click="emit('confirm')">Delete</button>
  </div>
</template>
