<script setup lang="ts">
import { onMounted, ref } from "vue";

export interface NoticeProps {
  message: string;
}

const { message } = defineProps<NoticeProps>();

const dismissed = ref(0);
const mounted = ref(false);

onMounted(() => {
  mounted.value = true;
});
</script>

<template>
  <section class="inbox" aria-label="Inbox">
    <p>Dismissed {{ dismissed }} times</p>
    <Teleport v-if="mounted" to="body">
      <div data-teleported="true" class="notice">
        <p role="status">{{ message }} ({{ dismissed }})</p>
        <button type="button" @click="dismissed++">Dismiss</button>
      </div>
    </Teleport>
  </section>
</template>
