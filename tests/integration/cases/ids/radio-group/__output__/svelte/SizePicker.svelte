<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts" module>
  export interface SizePickerProps {
    legend: string;
    sizes: string[];
  }
</script>

<script lang="ts">
  import type { ClassValue, HTMLFieldsetAttributes } from "svelte/elements";

  type Props = Omit<
    HTMLFieldsetAttributes,
    "legend" | "sizes" | "children" | "class" | "style" | "ref"
  > &
    SizePickerProps & {
      class?: ClassValue;
      style?: string;
      ref?: HTMLElementTagNameMap["fieldset"] | null;
    };

  let {
    legend,
    sizes,
    class: className,
    style,
    ref = $bindable(null),
    ...attributes
  }: Props = $props();

  const uid = $props.id();
  const group = `uf-id-${uid}-0`;
  const hintId = `uf-id-${uid}-1`;
  let picked = $state("");

  function choose(size: string) {
    picked = size;
  }
</script>

<fieldset
  class={["size-picker", className]}
  aria-describedby={hintId}
  {style}
  bind:this={ref}
  {...attributes}
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
