<script setup lang="ts">
import KeepAliveComponent from "./KeepAlive.vue";
import TransitionComponent_1 from "./Transition.vue";
import TransitionComponent from "./TransitionComponent.vue";
</script>

<template>
  <section aria-label="Wizard">
    <TransitionComponent_1 step="details" />
    <TransitionComponent />
    <KeepAliveComponent :level="2" />
  </section>
</template>
