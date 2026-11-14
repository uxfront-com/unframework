<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts" module>
  export interface GlossaryProps {
    terms: string[];
    definitions: string[];
  }
</script>

<script lang="ts">
  import type { ClassValue } from "svelte/elements";

  type Props = GlossaryProps & { class?: ClassValue; style?: string };

  let { terms, definitions, class: className, style, ...attributes }: Props = $props();

  let index = $state(0);
  const definition = $derived(definitions[index] ?? "");

  function next() {
    index = (index + 1) % terms.length;
  }

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }
</script>

<section
  class={["glossary", className]}
  aria-label="Glossary"
  {style}
  {...scopeAttributes(attributes)}
>
  <h2>{terms[index]}</h2
  ><div class="definition">{@html definition}</div
  ><button type="button" onclick={next}>Next term</button>
</section>
