<script setup lang="ts">
import { onMounted, ref } from "vue";

export interface TipProps {
  label: string;
}

const { label } = defineProps<TipProps>();
defineOptions({ inheritAttrs: false });

const mounted = ref(false);

onMounted(() => {
  mounted.value = true;
});
</script>

<template>
  <Teleport v-if="mounted" to="body">
    <p data-teleported="true" class="tip" role="note">{{ label }} tip</p>
  </Teleport>
</template>
