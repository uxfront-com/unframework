<script setup lang="ts">
export interface InboxSummaryProps {
  folder: string;
  unread: number;
  flagged: number;
  signature: string;
}

const { folder, unread, flagged, signature } = defineProps<InboxSummaryProps>();
</script>

<template>
  <section class="inbox-summary" aria-label="Inbox summary">
    <h2>{{ folder || "Inbox" }}</h2>
    <p v-if="unread">{{ unread }} unread</p>
    <p v-if="flagged">{{ flagged }} flagged</p>
    <p v-if="unread > 0 && flagged > 0">Some unread messages are flagged.</p>
    <p v-if="folder">Filed under {{ folder }}</p>
    <p v-if="signature" class="inbox-signature">{{ signature }}</p>
  </section>
</template>
