<script setup vapor lang="ts">
import Member from "./Member.vue";

const { id } = defineProps<{ id: string }>();
defineOptions({ inheritAttrs: false });
</script>

<template>
  <Suspense>
    <Member :id="id" v-bind="$attrs" />
  </Suspense>
</template>
