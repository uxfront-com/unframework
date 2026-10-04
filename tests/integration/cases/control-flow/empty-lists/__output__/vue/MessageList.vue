<script setup lang="ts">
export interface InboxMessage {
  id: string;
  subject: string;
}

export interface MessageListProps {
  messages: InboxMessage[];
  archived?: InboxMessage[];
  emptyText?: string;
}

const {
  messages,
  archived = [],
  emptyText = "Nothing here yet.",
} = defineProps<MessageListProps>();
</script>

<template>
  <section class="message-list" aria-label="Messages">
    <h2>Inbox</h2>
    <ul>
      <li v-for="message in messages" :key="message.id">{{ message.subject }}</li>
    </ul>
    <p v-if="messages.length === 0">{{ emptyText }}</p>
    <h2>Archive</h2>
    <ul>
      <li v-for="message in archived" :key="message.id">{{ message.subject }}</li>
    </ul>
    <p v-if="archived.length === 0">No archived messages.</p>
    <p v-else>{{ archived.length }} archived</p>
  </section>
</template>
