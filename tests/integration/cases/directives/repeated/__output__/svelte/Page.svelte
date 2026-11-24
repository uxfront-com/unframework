<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import Choice from "./Choice.svelte";
  import List from "./List.svelte";
  import Wrapper from "./Wrapper.svelte";
  import { vTrace } from "./vTrace.svelte";
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<SvelteHTMLElements["section"], "children" | "class" | "style" | "ref"> & {
    class?: ClassValue;
    style?: string;
    ref?: HTMLElementTagNameMap["section"] | null;
  };

  let { class: className, style, ref = $bindable(null), ...attributes }: Props = $props();

  let label = $state("first");
  let note: HTMLParagraphElement | null = null;
  let noted = $state("");
</script>

<section class={["page", className]} aria-label="Page" {style} bind:this={ref} {...attributes}>
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
