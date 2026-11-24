<script setup lang="ts">
import Bio from "./Bio.vue";
import NameField from "./NameField.vue";
import { computed, useTemplateRef } from "vue";

const nameComponent = useTemplateRef<{ $el: HTMLInputElement }>("nameComponent");
const name = computed(() => nameComponent.value?.$el ?? null);

const bioComponent = useTemplateRef<{ $el: HTMLInputElement }>("bioComponent");
const bio = computed(() => bioComponent.value?.$el ?? null);
</script>

<template>
  <form aria-label="Profile">
    <NameField ref="nameComponent" label="Name" />
    <button type="button" @click="name?.focus()">Edit name</button>
    <Bio ref="bioComponent" label="Bio" />
    <button type="button" @click="bio?.focus()">Edit bio</button>
  </form>
</template>
