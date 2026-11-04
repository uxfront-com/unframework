<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts" module>
  export interface SizePickerProps {
    legend: string;
    sizes: string[];
  }
</script>

<script lang="ts">
  import type { ClassValue } from "svelte/elements";

  type Props = SizePickerProps & { class?: ClassValue; style?: string };

  let { legend, sizes, class: className, style, ...attributes }: Props = $props();

  const uid = $props.id();
  const group = `uf-id-${uid}-0`;
  const hintId = `uf-id-${uid}-1`;
  let picked = $state("");

  function choose(size: string) {
    picked = size;
  }

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }
</script>

<fieldset
  class={["size-picker", className]}
  aria-describedby={hintId}
  {style}
  {...scopeAttributes(attributes)}
>
  <legend>{legend}</legend
  ><p id={hintId}>Pick one size.</p
  >{#each sizes as size, index (size)}
    <div class="size">
      <input
        type="radio"
        id={`${group}-${index}`}
        name={group}
        {...{ value: size }}
        onchange={() => choose(size)}
      /><label for={`${group}-${index}`}>{size}</label>
    </div>
  {/each}<output>{picked || "none"}</output>
</fieldset>
