<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts" module>
  export interface AuthorBylineProps {
    author: string;
    published: string;
    minutes: number;
    affiliation?: string;
  }
</script>

<script lang="ts">
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<
    SvelteHTMLElements["p"],
    "author" | "published" | "minutes" | "affiliation" | "children" | "class" | "style" | "ref"
  > &
    AuthorBylineProps & {
      class?: ClassValue;
      style?: string;
      ref?: HTMLElementTagNameMap["p"] | null;
    };

  let { class: className, style, ref = $bindable(null), ...props }: Props = $props();

  let {
    author: _author,
    published: _published,
    minutes: _minutes,
    affiliation: _affiliation,
    ...attributes
  } = $derived(props);
</script>

<p
  class={["byline", className]}
  {style}
  bind:this={ref}
  {...attributes}
>By {props.author}, {props.affiliation ?? "independent"}<br /><time
  datetime={props.published}
>{props.published}</time> · {props.minutes} min read</p>
