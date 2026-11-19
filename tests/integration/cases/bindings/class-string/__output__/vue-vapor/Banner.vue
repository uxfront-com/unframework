<script lang="ts">
export interface BannerProps {
  message: string;
  tone: string;
  emphasis?: string | null;
}
</script>

<script setup vapor lang="ts">
const { message, tone, emphasis = undefined } = defineProps<BannerProps>();
</script>

<template>
  <div class="banner" :class="tone" role="note">
    <p :class="emphasis">{{ message }}</p>
    <p :class="`banner-footer banner-footer-${tone}`">Shown to every visitor.</p>
  </div>
</template>
