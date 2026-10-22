<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { ClassValue } from "svelte/elements";

  type Props = { class?: ClassValue; style?: string };

  let { class: className, style, ...attributes }: Props = $props();

  let size = $state("M");
  let quantity = $state(1);
  let note = $state("");
  let noteField: HTMLInputElement | null = null;

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }
</script>

<section
  class={["shirt-order", className]}
  aria-label="Shirt order"
  {style}
  {...scopeAttributes(attributes)}
>
  <p role="status">{`${quantity} x size ${size}`}</p
  ><div role="group" aria-label="Size">
    <button
      type="button"
      value="S"
      aria-pressed={size === "S"}
      onclick={(event) => (size = (event.currentTarget as HTMLButtonElement).value)}
    >Small</button
    ><button
      type="button"
      value="M"
      aria-pressed={size === "M"}
      onclick={(event) => (size = (event.currentTarget as HTMLButtonElement).value)}
    >Medium</button
    ><button
      type="button"
      value="L"
      aria-pressed={size === "L"}
      onclick={(event) => (size = (event.currentTarget as HTMLButtonElement).value)}
    >Large</button>
  </div
  ><button type="button" onclick={() => quantity++}>Add one</button
  ><label>Note<input
    name="note"
    bind:this={noteField}
    oninput={(event) => (note = (event.currentTarget as HTMLInputElement).value)}
  /></label
  ><p>Note: {note}</p
  ><button
    type="button"
    onclick={() => {
      quantity = 1;
      size = "M";
      note = "";
      const input = noteField;
      if (input) input.value = "";
    }}
  >Reset</button>
</section>
