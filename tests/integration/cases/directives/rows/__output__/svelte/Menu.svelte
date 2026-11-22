<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import Picker from "./Picker.svelte";
  import { vMark } from "./vMark.svelte";
  import { vTrace } from "./vTrace.svelte";
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<SvelteHTMLElements["section"], "children" | "class" | "style" | "ref"> & {
    class?: ClassValue;
    style?: string;
    ref?: HTMLElementTagNameMap["section"] | null;
  };

  let { class: className, style, ref = $bindable(null), ...attributes }: Props = $props();

  let items = $state.raw<{ id: string; label: string; note?: string }[]>([
    { id: "a", label: "Alpha", note: "First" },
    { id: "b", label: "Beta" },
    { id: "c", label: "Gamma" },
  ]);

  let prefix = $state("Open");
  let focused = $state(0);
</script>

<section class={["menu", className]} aria-label="Menu" {style} bind:this={ref} {...attributes}>
  <ul aria-label="Items">
    {#each items as item (item.id)}
      <li
        data-name={item.id}
        {@attach vTrace(() => item.label)}
      >{item.label}{#if item.note}{@const traceValue = item.note}<b
        data-name={`note-${item.id}`}
        {@attach vTrace(() => traceValue)}
      >{item.note}</b>{/if}</li>
    {/each}
  </ul
  ><ul aria-label="Marked">
    {#each items as item (item.id)}
      <li
        data-name={`both-${item.id}`}
        {@attach vTrace(() => item.label)}
        {@attach vMark(() => item.id)}
      >{item.label}</li>
    {/each}
  </ul
  ><div class="focus">
    {#each items as item (item.id)}
      <button
        type="button"
        data-name={`focus-${item.id}`}
        onfocusin={() => focused++}
        {@attach vTrace(() => item.label)}
      >Focus {item.label}</button>
    {/each}
  </div
  ><output>{focused}</output
  ><ul aria-label="Prefixed">
    {#each items as item (item.id)}
      <li
        data-name={`prefixed-${item.id}`}
        {@attach vTrace(() => `${prefix} ${item.label}`)}
      >{item.label}</li>
    {/each}
  </ul
  ><Picker>
    {#snippet option({ option })}
      <span
        data-name={`option-${option.id}`}
        {@attach vTrace(() => `${prefix} ${option.label}`)}
      >{option.label}</span>
    {/snippet}
  </Picker
  ><button
    type="button"
    onclick={() => (items = items.map((item) =>
      item.id === "a" ? { id: "a", label: "Alpha 2", note: "First" } : item,
    ))}
  >Rename first</button
  ><button type="button" onclick={() => (items = [...items].reverse())}>Reverse</button
  ><button
    type="button"
    onclick={() => (items = items.filter((item) => item.id !== "b"))}
  >Remove second</button
  ><button
    type="button"
    onclick={() => (items = [...items, { id: "d", label: "Delta" }])}
  >Add item</button
  ><button type="button" onclick={() => (prefix = "Close")}>Change prefix</button>
</section>
