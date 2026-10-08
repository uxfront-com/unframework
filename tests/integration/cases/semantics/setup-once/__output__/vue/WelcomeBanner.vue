<script setup lang="ts">
export interface WelcomeBannerProps {
  name: string;
}

const { name } = defineProps<WelcomeBannerProps>();

const greeting = `Welcome, ${name}`;
const tips = ["Set up your profile", "Invite your team"];
</script>

<template>
  <section class="welcome-banner" aria-label="Welcome">
    <h2>{{ greeting }}</h2>
    <p>Signed in as {{ name }}</p>
    <ul>
      <li v-for="tip in tips" :key="tip">{{ tip }}</li>
    </ul>
  </section>
</template>
