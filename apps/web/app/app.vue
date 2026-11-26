<script setup lang="ts">
// This app.vue replaces the Docus one, so docs pages and the changelog mount the
// Docus shell (header, sidebar, search) themselves. The homepage brings its own,
// and doesn't load this one.
const DocusApp = defineAsyncComponent(() => import("docus/app/app.vue"));

const route = useRoute();
const under = (base: string) => route.path === base || route.path.startsWith(`${base}/`);
const isDocs = computed(() => under("/docs"));
const usesDocus = computed(() => isDocs.value || under("/changelog"));

useHead({
	titleTemplate: (title) => (title ? `${title} - Unframework` : "Unframework"),
});

// Points answer engines and agents at each docs page's and changelog entry's
// markdown copy (server/middleware/raw-markdown.ts), as llms.txt does (audit
// finding A5). /docs only redirects, and /changelog has no copy of its own.
const hasRawCopy = computed(
	() => (isDocs.value && route.path !== "/docs") || route.path.startsWith("/changelog/"),
);
useHead(() => ({
	link: hasRawCopy.value
		? [{ rel: "alternate", type: "text/markdown", href: `/raw${route.path}.md` }]
		: [],
}));
</script>

<template>
	<NuxtRouteAnnouncer />
	<DocusApp v-if="usesDocus" />
	<NuxtPage v-else />
</template>
