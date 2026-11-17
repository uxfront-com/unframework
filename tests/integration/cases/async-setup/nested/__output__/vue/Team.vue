<script setup lang="ts">
import Lead from "./Lead.vue";
import Member from "./Member.vue";
import { useTemplateRef } from "vue";

const { ids } = defineProps<{ ids: string[] }>();

const first = useTemplateRef<{ reset(): void }>("first");
</script>

<template>
  <section class="team" aria-label="Team">
    <h2>Team</h2>
    <button type="button" @click="first?.reset()">Reset</button>
    <Suspense>
      <Member id="ada" ref="first" />
    </Suspense>
    <ul>
      <li v-for="id in ids" :key="id">
        <Suspense>
          <Member :id="id" />
        </Suspense>
      </li>
    </ul>
    <Lead id="hopper" class="lead" />
  </section>
</template>
