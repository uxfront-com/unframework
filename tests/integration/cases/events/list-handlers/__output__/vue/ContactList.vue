<script setup lang="ts">
import { ref, shallowRef } from "vue";

export interface Contact {
  id: string;
  name: string;
}

export interface ContactListProps {
  initial: Contact[];
}

const { initial } = defineProps<ContactListProps>();
const emit = defineEmits<{ choose: [id: string, position: number]; removed: [name: string] }>();

const contacts = shallowRef(initial);
const chosen = ref<string>();

function pick(entry: Contact, position: number) {
  chosen.value = entry.id;
  emit("choose", entry.id, position);
}

function drop(entry: Contact) {
  contacts.value = contacts.value.filter((other) => other.id !== entry.id);
  emit("removed", entry.name);
}
</script>

<template>
  <section class="contact-list" aria-label="Contacts">
    <ul>
      <li v-for="(contact, index) in contacts" :key="contact.id">
        <button
          type="button"
          :aria-pressed="chosen === contact.id"
          @click="pick(contact, index)"
        >{{ contact.name }}</button>
        <button
          type="button"
          :aria-label="`Remove ${contact.name}`"
          @click="drop(contact)"
        >Remove</button>
      </li>
    </ul>
    <p role="status">Chosen: {{ chosen ?? "nobody" }}</p>
  </section>
</template>
