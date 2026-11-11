<script setup lang="ts">
function charge() {
  throw new Error("The card was declined");
}
</script>

<template>
  <button type="button" @click="charge">Charge</button>
</template>
