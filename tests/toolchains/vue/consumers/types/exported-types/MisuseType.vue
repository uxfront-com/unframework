<script setup lang="ts">
import Button from "../../../../../integration/cases/types/exported-types/__output__/vue/Button.vue";
import type {
  ButtonProps,
  ButtonSize,
} from "../../../../../integration/cases/types/exported-types/__output__/vue/Button.vue";

// @uf-expect TS2322 Button.type:ButtonProps
const props: ButtonProps = { label: "Save", tone: "danger" };
// @uf-expect TS2322 Button.type:ButtonSize
const size: ButtonSize = "huge";
</script>

<template>
  <Button :label="props.label" :data-size="size" />
</template>
