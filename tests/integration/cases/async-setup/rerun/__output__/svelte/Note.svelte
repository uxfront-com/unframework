<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import { loadUser } from "./api";
  import { onMount, untrack } from "svelte";
  import type { ClassValue } from "svelte/elements";

  type Props = { id: string; onready?: (name: string) => void; class?: ClassValue; style?: string };

  let { id, onready, class: className, style, ...attributes }: Props = $props();

  let input: HTMLInputElement | null = null;

  onMount(() => {
    input?.focus();
    onready?.(user.name);
  });

  const user = await untrack(() => loadUser(id));

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }
</script>

<form class={["note", className]} aria-label="Note" {style} {...scopeAttributes(attributes)}>
  <label>Note for {user.name} <input bind:this={input} type="text" /></label>
</form>
