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
  import type { ClassValue } from "svelte/elements";

  type Props = NoticeProps & { class?: ClassValue; style?: string };

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
    ...attributes
  }: Props = $props();

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }
</script>

<section
  class={["notice", className]}
  aria-label={title}
  data-tone={tone}
  {style}
  {...scopeAttributes(attributes)}
>
  <h2>{title}</h2
  ><p>{message}</p
  ><details open={expanded}>
    <summary>Priority {priority}</summary
    ><p>Tagged {tags.join(", ")}, posted by {author.name}.</p>
  </details>
</section>
