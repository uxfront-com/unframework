<script setup lang="ts">
import type { ChangelogCollectionItem } from "@nuxt/content";
import type { Component, FunctionalComponent } from "vue";

import { ProseH3, ProseH4 } from "#components";

/**
 * One changelog entry: its version and date, the title (the `title` slot, an
 * `<h2>` linking to the entry on /changelog and the page's `<h1>` on its own),
 * its notes, the link to read more and the release on GitHub.
 */
const props = defineProps<{
	entry: ChangelogCollectionItem;
	// On /changelog, which lists every entry.
	listed?: boolean;
}>();

// The notes' headings start at `##`, right below the entry's own page's <h1>. The
// list titles each entry with an <h2>, so there they move down a level, and lose
// their ids, which every entry's New section would share.
const listedHeading =
	(heading: Component): FunctionalComponent =>
	(_props, { slots }) =>
		h(heading, null, slots);
const listedHeadings = { h2: listedHeading(ProseH3), h3: listedHeading(ProseH4) };

// Entries are dated like 2026-11-21, which Date reads as midnight UTC: formatted
// in UTC, it's the same day in every time zone, on the server and in the browser.
const date = new Intl.DateTimeFormat("en-GB", { dateStyle: "long", timeZone: "UTC" }).format(
	new Date(props.entry.date),
);
</script>

<template>
	<div class="flex items-center gap-3">
		<UBadge :label="entry.version" color="primary" variant="subtle" size="lg" />
		<time :datetime="entry.date" class="text-sm text-muted">{{ date }}</time>
	</div>

	<slot name="title" />

	<ContentRenderer :value="entry" :components="listed ? listedHeadings : undefined" class="mt-4" />

	<!-- The release's link names its version, so each one on /changelog has a name of its own. -->
	<div class="mt-6 flex flex-wrap gap-x-6 gap-y-3">
		<NuxtLink
			v-if="entry.link"
			:to="entry.link.to"
			class="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
		>
			<UIcon name="i-lucide-book-open" class="size-4" />
			{{ entry.link.label }}
			<UIcon name="i-lucide-arrow-right" class="size-3.5" />
		</NuxtLink>
		<NuxtLink
			:to="entry.release"
			class="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
		>
			<UIcon name="i-simple-icons-github" class="size-4" />
			Read the {{ entry.version }} release on GitHub
			<UIcon name="i-lucide-arrow-right" class="size-3.5" />
		</NuxtLink>
	</div>
</template>
