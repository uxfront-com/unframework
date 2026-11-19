<script setup vapor lang="ts">
import { loadUser } from "./api";
import { shallowRef } from "vue";

const { id } = defineProps<{ id: string }>();

defineExpose({ reset });

const user = await loadUser(id);
const visits = shallowRef(user.visits);

function reset() {
  visits.value = 0;
}
</script>

<template>
  <article class="member">
    <h3>{{ user.name }}</h3>
    <button type="button" @click="visits++">{{ user.name }} visits: {{ visits }}</button>
  </article>
</template>
