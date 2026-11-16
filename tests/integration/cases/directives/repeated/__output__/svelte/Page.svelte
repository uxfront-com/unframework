<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import Choice from "./Choice.svelte";
  import List from "./List.svelte";
  import Wrapper from "./Wrapper.svelte";
  import { vTrace } from "./vTrace.svelte";
  import type { ClassValue } from "svelte/elements";

  type Props = { class?: ClassValue; style?: string };

  let { class: className, style, ...attributes }: Props = $props();

  let label = $state("first");
  let note: HTMLParagraphElement | null = null;
  let noted = $state("");

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }
</script>

<section class={["page", className]} aria-label="Page" {style} {...scopeAttributes(attributes)}>
  <Wrapper>
    {#snippet row()}
      <span data-name="row" {@attach vTrace(() => label)}>Row</span>
    {/snippet}
  </Wrapper
  ><Choice>
    {#snippet body()}
      <em data-name="body" {@attach vTrace(() => label)}>Body</em>
    {/snippet}
  </Choice
  ><List items={["a", "b"]}>
    {#snippet item({ item })}
      <strong data-name="item" {@attach vTrace(() => label)}>{item}</strong>
    {/snippet}
  </List
  ><p bind:this={note} data-name="note" {@attach vTrace(() => label)}>Note</p
  ><output>{noted}</output
  ><button
    type="button"
    onclick={() => (noted = note?.getAttribute("data-name") ?? "")}
  >Check</button
  ><button type="button" onclick={() => (label = "second")}>Rename</button>
</section>
