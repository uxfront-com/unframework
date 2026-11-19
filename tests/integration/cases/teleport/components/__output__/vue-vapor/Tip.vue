<script lang="ts">
export interface TipProps {
  label: string;
}
</script>

<script setup vapor lang="ts">
import { onMounted, ref } from "vue";

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
