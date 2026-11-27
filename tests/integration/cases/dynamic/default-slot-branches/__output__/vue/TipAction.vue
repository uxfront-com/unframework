<script setup lang="ts">
import { type IntrinsicElementAttributes, onMounted, ref } from "vue";

const { href = undefined, label } = defineProps<
  { href?: string; label: string } & /* @vue-ignore */ Omit<
    IntrinsicElementAttributes["a"] & IntrinsicElementAttributes["button"],
    "href" | "label"
  >
>();
defineSlots<{ default?(): unknown }>();

const mounted = ref(false);

onMounted(() => {
  mounted.value = true;
});
</script>

<template>
  <component
    :is="href ? 'a' : 'button'"
    :href="(href ? 'a' : 'button') === 'a' ? href : undefined"
  >{{ label }}<Teleport
    v-if="mounted"
    to="body"
  ><p data-teleported="true" class="tip" role="note"><slot>{{ label }}</slot></p></Teleport></component>
</template>
