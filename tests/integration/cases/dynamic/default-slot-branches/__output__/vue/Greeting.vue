<script setup lang="ts">
export interface User {
  name: string;
}

const { user = undefined } = defineProps<{ user?: User }>();
defineSlots<{ default?(): unknown }>();
</script>

<template>
  <p class="greeting">
    <b v-if="user">
      <slot>{{ user.name }}</slot>
    </b>
    <i v-else>
      <slot>Guest</slot>
    </i>
  </p>
</template>
