<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts" module>
  export interface NoticeProps {
    message: string;
    title?: string;
    tone?: "info" | "warning";
    priority?: number;
    expanded?: boolean;
    tags?: string[];
    author?: { name: string };
  }
</script>

<script lang="ts">
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<
    SvelteHTMLElements["section"],
    | "message"
    | "title"
    | "tone"
    | "priority"
    | "expanded"
    | "tags"
    | "author"
    | "children"
    | "class"
    | "style"
    | "ref"
  > &
    NoticeProps & {
      class?: ClassValue;
      style?: string;
      ref?: HTMLElementTagNameMap["section"] | null;
    };

  let {
    message,
    title = "Notice",
    tone = "info",
    priority = 1,
    expanded = false,
    tags = ["general"],
    author = { name: "System" },
    class: className,
    style,
    ref = $bindable(null),
    ...attributes
  }: Props = $props();
</script>

<section
  class={["notice", className]}
  aria-label={title}
  data-tone={tone}
  {style}
  bind:this={ref}
  {...attributes}
>
  <h2>{title}</h2
  ><p>{message}</p
  ><details open={expanded}>
    <summary>Priority {priority}</summary
    ><p>Tagged {tags.join(", ")}, posted by {author.name}.</p>
  </details>
</section>
