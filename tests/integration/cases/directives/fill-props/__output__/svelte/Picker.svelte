<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { Snippet } from "svelte";
  import type { ClassValue } from "svelte/elements";

  type Props = {
    option?: Snippet<[{ option: { id: string; label: string } }]>;
    class?: ClassValue;
    style?: string;
  };

  let { option: optionSnippet, class: className, style, ...attributes }: Props = $props();

  let options = $state.raw([
    { id: "x", label: "Xray" },
    { id: "y", label: "Yankee" },
  ]);

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }
</script>

<div class={["picker", className]} {style} {...scopeAttributes(attributes)}>
  <ul aria-label="Options">
    {#each options as option (option.id)}
      <li>{@render optionSnippet?.({ option })}</li>
    {/each}
  </ul
  ><button
    type="button"
    onclick={() => (options = options.map((option) =>
      option.id === "x" ? { id: "x", label: "Xenon" } : option,
    ))}
  >Rename option</button>
</div>
