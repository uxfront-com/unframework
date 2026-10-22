<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import { onMount } from "svelte";
  import type { ClassValue } from "svelte/elements";

  type Props = { onsaved?: (count: number) => void; class?: ClassValue; style?: string };

  let { onsaved, class: className, style, ...attributes }: Props = $props();

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

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }
</script>

<section
  class={["draft-editor", className]}
  aria-label="Draft"
  {style}
  {...scopeAttributes(attributes)}
>
  <label>Draft<textarea name="draft"></textarea></label
  ><p role="status">Saved: {saves}</p>
</section>
