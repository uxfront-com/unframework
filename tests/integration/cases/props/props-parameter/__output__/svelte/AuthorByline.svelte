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

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }
</script>

<p
  class={["byline", className]}
  {style}
  {...scopeAttributes(props)}
>By {props.author}, {props.affiliation ?? "independent"}<br /><time
  datetime={props.published}
>{props.published}</time> · {props.minutes} min read</p>
