<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import { onMount } from "svelte";
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<
    SvelteHTMLElements["section"],
    "onsaved" | "children" | "class" | "style" | "ref"
  > & {
    onsaved?: (count: number) => void;
    class?: ClassValue;
    style?: string;
    ref?: HTMLElementTagNameMap["section"] | null;
  };

  let { onsaved, class: className, style, ref = $bindable(null), ...attributes }: Props = $props();

  let saves = $state(0);

  function onShortcut(event: KeyboardEvent) {
    if (event.key !== "s" || !event.ctrlKey) return;
    event.preventDefault();
    saves += 1;
    onsaved?.(saves);
  }

  onMount(() => {
    document.addEventListener("keydown", onShortcut);
  });

  onMount(() => () => {
    document.removeEventListener("keydown", onShortcut);
  });
</script>

<section
  class={["draft-editor", className]}
  aria-label="Draft"
  {style}
  bind:this={ref}
  {...attributes}
>
  <label>Draft<textarea name="draft"></textarea></label
  ><p role="status">Saved: {saves}</p>
</section>
