<script setup lang="ts">
import { UXFRONT_URL } from "~/data/site";

// Replaces Docus's, which prints the site name as plain text, to set the wordmark
// and "by UXFront" the way the homepage header does. The byline sits beside the
// home link, not inside it, since it holds a link of its own. Phones leave it out:
// beside the header's buttons, it pushes the menu toggle off-screen.
const appConfig = useAppConfig();
const site = useSiteConfig();
const { localePath } = useDocusI18n();

const ariaLabel = appConfig.header?.title || site.name;
</script>

<template>
  <div class="flex items-center gap-3 min-w-0">
    <NuxtLink :to="localePath('/')" :aria-label="ariaLabel" class="shrink-0">
      Unframework
    </NuxtLink>
    <span class="hidden sm:inline-flex items-center gap-1.5 text-xs text-muted whitespace-nowrap">
      by
      <a
        :href="UXFRONT_URL"
        class="inline-flex items-center gap-1 font-medium text-toned hover:text-highlighted transition-colors"
      >
        <UxFrontMark class="size-3.5" />
        <span><strong>UX</strong>Front</span>
      </a>
    </span>
  </div>
</template>
