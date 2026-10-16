<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { ClassValue } from "svelte/elements";

  export interface AuthorBylineProps {
    author: string;
    published: string;
    minutes: number;
    affiliation?: string;
  }

  type Props = AuthorBylineProps & { class?: ClassValue; style?: string };

  let { class: className, style, ...props }: Props = $props();
</script>

<p
  class={["byline", className]}
  {style}
>By {props.author}, {props.affiliation ?? "independent"}<br /><time
  datetime={props.published}
>{props.published}</time> · {props.minutes} min read</p>
