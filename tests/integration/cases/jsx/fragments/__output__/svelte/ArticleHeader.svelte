<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts" module>
  export interface ArticleHeaderProps {
    title: string;
    subtitle?: string;
    draft: boolean;
    tags: string[];
  }
</script>

<script lang="ts">
  let { title, subtitle, draft, tags }: ArticleHeaderProps = $props();
</script>

<h2>{title}</h2
>{#if subtitle}
  <p class="article-subtitle">{subtitle}</p>
{/if}{#if draft}
  <p class="article-badge">Draft</p
  ><p>Only editors can see this article.</p>
{:else}
  <p class="article-badge">Published</p
  ><p>Everyone can read this article.</p>
{/if}<p>Tagged {tags.join(", ")}</p>
