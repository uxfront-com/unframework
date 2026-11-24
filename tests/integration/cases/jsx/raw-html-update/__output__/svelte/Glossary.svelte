<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts" module>
  export interface GlossaryProps {
    terms: string[];
    definitions: string[];
  }
</script>

<script lang="ts">
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<
    SvelteHTMLElements["section"],
    "terms" | "definitions" | "children" | "class" | "style" | "ref"
  > &
    GlossaryProps & {
      class?: ClassValue;
      style?: string;
      ref?: HTMLElementTagNameMap["section"] | null;
    };

  let {
    terms,
    definitions,
    class: className,
    style,
    ref = $bindable(null),
    ...attributes
  }: Props = $props();

  let index = $state(0);
  const definition = $derived(definitions[index] ?? "");

  function next() {
    index = (index + 1) % terms.length;
  }
</script>

<section
  class={["glossary", className]}
  aria-label="Glossary"
  {style}
  bind:this={ref}
  {...attributes}
>
  <h2>{terms[index]}</h2
  ><div class="definition">{@html definition}</div
  ><button type="button" onclick={next}>Next term</button>
</section>
