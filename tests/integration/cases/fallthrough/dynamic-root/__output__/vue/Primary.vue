<script setup lang="ts">
import Base from "./Base.vue";

const {
  href = undefined,
  disabled = undefined,
  text,
} = defineProps<{ href?: string; disabled?: boolean; text: string }>();
const emit = defineEmits<{ press: [] }>();
</script>

<template>
  <Base
    :href="href"
    :disabled="disabled"
    :text="text"
    class="primary"
    @press="() => emit('press')"
  />
</template>
