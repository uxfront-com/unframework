<script setup lang="ts">
import Button, {
  type ButtonProps,
  type ButtonSize,
} from "../../../../../integration/cases/types/exported-types/__output__/vue/Button.vue";

const props: ButtonProps = { label: "Save", tone: "secondary" };
const size: ButtonSize = "large";
</script>

<template>
  <Button :label="props.label" :tone="props.tone" :data-size="size" />
</template>
