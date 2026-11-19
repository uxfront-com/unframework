<script setup vapor lang="ts">
import { loadUser } from "./api";
import { shallowRef } from "vue";

const { id } = defineProps<{ id: string }>();

const user = await loadUser(id);
const visits = shallowRef(user.visits);
</script>

<template>
  <p
    class="profile"
  >{{ user.name }} <button type="button" @click="visits++">Visits: {{ visits }}</button></p>
</template>
