<script setup lang="ts">
import Action from "./Action.vue";
import { ref } from "vue";

const linked = ref(true);
</script>

<template>
  <section class="page">
    <Action href="#docs" label="Docs">Read the docs</Action>
    <Action label="Save">Save the draft</Action>
    <Action href="#home" label="Home" />
    <Action label="Close" />
    <Action :href="linked ? '#more' : undefined" label="More">
      <template #default>Learn more</template>
      <template #icon>
        <i aria-hidden="true">+</i>
      </template>
    </Action>
    <button type="button" @click="linked = !linked">Toggle</button>
  </section>
</template>
