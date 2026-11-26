import { defineCollection, defineContentConfig, z } from "@nuxt/content";

// Nuxt Content merges this with the collections Docus defines (`docs`, for
// content/docs/), so this only adds the changelog, one entry per release in
// content/changelog/, listed at /changelog and served at /changelog/<file name>.
export default defineContentConfig({
	collections: {
		changelog: defineCollection({
			type: "page",
			source: "changelog/*.md",
			schema: z.object({
				// The day the release was published on npm, as in 2026-11-21. Entries are
				// listed newest first, so one that shares its day with another gets a time
				// too, in UTC, as in 2026-11-21T12:00:00Z, which still shows as the day.
				date: z.string(),
				// The version of @uxfront/unframework, as in 0.5.0: the badge beside the date.
				version: z.string(),
				// The release on GitHub.
				release: z.string(),
				// Where to read more, usually the docs page it adds or changes.
				link: z.object({ label: z.string(), to: z.string() }).optional(),
			}),
		}),
	},
});
