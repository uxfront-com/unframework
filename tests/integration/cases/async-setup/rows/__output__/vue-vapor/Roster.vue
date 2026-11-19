<script setup vapor lang="ts">
import Member from "./Member.vue";
import { ref } from "vue";

const { ids } = defineProps<{ ids: string[] }>();

const lead = ref(true);
const guest = ref(false);
</script>

<template>
  <section class="roster" aria-label="Roster">
    <button type="button" @click="lead = !lead">Switch lead</button>
    <button type="button" @click="guest = !guest">Toggle guest</button>
    <ul>
      <Suspense v-for="id in ids" :key="id">
        <Member :id="id" />
      </Suspense>
      <Suspense v-if="lead">
        <Member id="ada" />
      </Suspense>
      <Suspense v-else>
        <Member id="linus" />
      </Suspense>
      <Suspense v-if="guest">
        <Member id="hopper" />
      </Suspense>
    </ul>
  </section>
</template>
