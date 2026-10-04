<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  export interface NoticeProps {
    message: string;
    title?: string;
    tone?: "info" | "warning";
    priority?: number;
    expanded?: boolean;
    tags?: string[];
    author?: { name: string };
  }

  let {
    message,
    title = "Notice",
    tone = "info",
    priority = 1,
    expanded = false,
    tags = ["general"],
    author = { name: "System" },
  }: NoticeProps = $props();
</script>

<section class="notice" aria-label={title} data-tone={tone}>
  <h2>{title}</h2
  ><p>{message}</p
  ><details open={expanded}>
    <summary>Priority {priority}</summary
    ><p>Tagged {tags.join(", ")}, posted by {author.name}.</p>
  </details>
</section>
