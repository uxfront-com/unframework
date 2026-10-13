<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { ClassValue } from "svelte/elements";

  export interface SizePickerProps {
    legend: string;
    sizes: string[];
  }

  type Props = SizePickerProps & { class?: ClassValue; style?: string };

  let { legend, sizes, class: className, style }: Props = $props();

  const uid = $props.id();
  const group = `uf-id-${uid}-0`;
  const hintId = `uf-id-${uid}-1`;
  let picked = $state("");

  function choose(size: string) {
    picked = size;
  }
</script>

<fieldset class={["size-picker", className]} aria-describedby={hintId} {style}>
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
