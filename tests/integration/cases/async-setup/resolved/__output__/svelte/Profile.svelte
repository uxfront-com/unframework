<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import { loadUser } from "./api";
  import { untrack } from "svelte";
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<SvelteHTMLElements["p"], "id" | "children" | "class" | "style" | "ref"> & {
    id: string;
    class?: ClassValue;
    style?: string;
    ref?: HTMLElementTagNameMap["p"] | null;
  };

  let { id, class: className, style, ref = $bindable(null), ...attributes }: Props = $props();

  const user = await untrack(() => loadUser(id));
  let visits = $state.raw(user.visits);
</script>

<p
  class={["profile", className]}
  {style}
  bind:this={ref}
  {...attributes}
>{user.name} <button type="button" onclick={() => visits++}>Visits: {visits}</button></p>
