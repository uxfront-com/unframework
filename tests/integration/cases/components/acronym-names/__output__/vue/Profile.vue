<script setup lang="ts">
import Avatar from "./Avatar.vue";
import { ref } from "vue";

const picked = ref("none");
</script>

<template>
  <div>
    <Avatar image-u-r-l="/a.png" :user-i-d="7" @picked-u-r-l="(url) => (picked = url)" />
    <output>Picked: {{ picked }}</output>
  </div>
</template>
