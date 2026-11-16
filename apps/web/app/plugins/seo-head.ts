import seoData from "#seo-data";
import { SITE_URL } from "~/data/site";
import { breadcrumbList, homeGraph, techArticle } from "~/lib/structured-data";

// Marks the meta tags this plugin fills in from the page's own tags.
const INFER = "data-seo-infer";

interface Tag {
  tag: string;
  props: Record<string, unknown>;
  innerHTML?: unknown;
}

/**
 * Completes the head that `useUxHead` (@uxfront/layer-ui) and Docus's `useSeo`
 * write, since both live outside the app (audit findings O2, S1, S2 and S3):
 *
 * - `twitter:title` and `twitter:description` from the Open Graph tags, and an
 *   `og:image:alt` for an image that has none (the docs' generated cards).
 * - The homepage's Organization becomes its graph, and the docs' Article a
 *   TechArticle whose breadcrumbs link pages (app/lib/structured-data.ts).
 *
 * An Unhead hook rather than copies of Docus's page and `useSeo`, which would
 * drift with every Docus update: this reads the tags they write, whatever their
 * code, and `check:seo` fails if their shape changes under it. It runs on the
 * server and the client alike, so hydration and client-side navigation keep
 * the same tags.
 */
export default defineNuxtPlugin(() => {
  const head = injectHead();

  // nuxt-og-image sets og:image on the server only. The client's JSON-LD must
  // match the server's to the byte, or Unhead keeps the server's block and adds
  // a second one, so as it hydrates a page, it takes the image the server
  // rendered for that page.
  const rendered = import.meta.client
    ? {
        url: document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href,
        image: document.querySelector<HTMLMetaElement>('meta[property="og:image"]')?.content,
      }
    : undefined;

  // Low priority, so a page's own tag wins. A placeholder left empty isn't
  // rendered (Unhead drops a meta tag without content).
  head.push({
    meta: [
      { name: "twitter:title", content: "", [INFER]: "og:title", tagPriority: "low" },
      { name: "twitter:description", content: "", [INFER]: "og:description", tagPriority: "low" },
      { property: "og:image:alt", content: "", [INFER]: "og:image:alt", tagPriority: "low" },
    ],
  });

  head.use({
    key: "seo-head",
    hooks: {
      "tags:beforeResolve": ({ tags }: { tags: Tag[] }) => {
        const placeholders = tags.filter((tag) => typeof tag.props[INFER] === "string");
        const meta = (key: string) =>
          tags.find(
            (tag) => tag.tag === "meta" && !placeholders.includes(tag) && metaKey(tag) === key,
          )?.props.content as string | undefined;

        for (const tag of placeholders) {
          const source = tag.props[INFER] as string;
          delete tag.props[INFER];
          if (source !== "og:image:alt") tag.props.content = meta(source);
          else if (meta("og:image") && !meta("og:image:alt") && meta("og:title")) {
            tag.props.content = `${meta("og:title")}, a page of the Unframework docs`;
          }
        }
      },

      "tags:resolve": ({ tags }: { tags: Tag[] }) => {
        // nuxt-og-image makes the URL absolute only as the tags render.
        const og = tags.find((tag) => tag.tag === "meta" && metaKey(tag) === "og:image")?.props
          .content as string | undefined;
        const image = og?.startsWith("/") ? `${SITE_URL}${og}` : og;

        for (const tag of tags) {
          if (tag.tag !== "script" || tag.props.type !== "application/ld+json") continue;
          const block = parse(tag.innerHTML);
          if (!block) continue;

          let rewritten: Record<string, unknown> | undefined;
          if (block["@type"] === "Organization") {
            rewritten = homeGraph(typeof block.description === "string" ? block.description : "");
          } else if (block["@type"] === "Article") {
            const url = typeof block.url === "string" ? block.url : "";
            rewritten = techArticle(block, {
              dateModified: seoData.lastmod[url.slice(SITE_URL.length) || "/"],
              image: image ?? (rendered?.url === url ? rendered.image : undefined),
            });
          } else if (block["@type"] === "BreadcrumbList") {
            rewritten = breadcrumbList(block, seoData.sections);
          }
          if (rewritten) tag.innerHTML = JSON.stringify(rewritten);
        }
      },
    },
  });
});

function metaKey(tag: Tag) {
  return (tag.props.property ?? tag.props.name) as string | undefined;
}

function parse(content: unknown): Record<string, unknown> | undefined {
  if (content && typeof content === "object") return content as Record<string, unknown>;
  if (typeof content !== "string") return undefined;
  try {
    return JSON.parse(content) as Record<string, unknown>;
  } catch {
    return undefined;
  }
}
