<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import { loadUser } from "./api";
  import { untrack } from "svelte";
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<SvelteHTMLElements["article"], "id" | "children" | "class" | "style"> & {
    id: string;
    class?: ClassValue;
    style?: string;
  };

  let { id, class: className, style, ...attributes }: Props = $props();

  const user = await untrack(() => loadUser(id));
  let visits = $state.raw(user.visits);

  export function reset() {
    visits = 0;
  }
</script>

<article class={["member", className]} {style} {...attributes}>
  <h3>{user.name}</h3
  ><button type="button" onclick={() => visits++}>{user.name} visits: {visits}</button>
</article>
