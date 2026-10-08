<script setup lang="ts">
import { shallowRef } from "vue";

export interface Profile {
  name: string;
  title: string;
  available: boolean;
}

export interface ProfileCardProps {
  initial: Profile;
}

const { initial } = defineProps<ProfileCardProps>();

const profile = shallowRef(initial);

function rename(name: string) {
  profile.value = { ...profile.value, name };
}

function toggleAvailability() {
  profile.value = { ...profile.value, available: !profile.value.available };
}
</script>

<template>
  <article class="profile-card" aria-label="Profile">
    <h2>{{ profile.name }}</h2>
    <p>{{ profile.title }}</p>
    <p role="status">{{ profile.available ? "Available" : "Away" }}</p>
    <button type="button" @click="rename('Ada King')">Use married name</button>
    <button
      type="button"
      :aria-pressed="profile.available"
      @click="toggleAvailability"
    >Available</button>
  </article>
</template>
