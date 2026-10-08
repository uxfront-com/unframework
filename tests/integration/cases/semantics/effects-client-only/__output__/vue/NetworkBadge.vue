<script setup lang="ts">
import { onMounted, ref, watch } from "vue";

const online = ref<boolean>();
const label = ref("Checking the connection");

watch(online, (value) => {
  label.value = value ? "Online" : "Offline";
});

onMounted(() => {
  online.value = navigator.onLine;
});
</script>

<template>
  <p
    class="network-badge"
    role="status"
    :data-checked="online === undefined ? 'no' : 'yes'"
  >{{ label }}</p>
</template>
