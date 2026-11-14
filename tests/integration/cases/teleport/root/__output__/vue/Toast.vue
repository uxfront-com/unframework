<script setup lang="ts">
import { onMounted, ref } from "vue";

export interface ToastProps {
  message: string;
}

const { message } = defineProps<ToastProps>();
defineOptions({ inheritAttrs: false });

const mounted = ref(false);

onMounted(() => {
  mounted.value = true;
});
</script>

<template>
  <Teleport v-if="mounted" to="body">
    <div data-teleported="true" class="toast" role="alert" data-uf-416dbabb="">
      <p data-uf-416dbabb="">{{ message }}</p>
    </div>
  </Teleport>
</template>

<style src="./Toast.uf.tsx.css"></style>
