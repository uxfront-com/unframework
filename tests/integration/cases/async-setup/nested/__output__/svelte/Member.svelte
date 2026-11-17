<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import { loadUser } from "./api";
  import { untrack } from "svelte";
  import type { ClassValue } from "svelte/elements";

  type Props = { id: string; class?: ClassValue; style?: string };

  let { id, class: className, style, ...attributes }: Props = $props();

  const user = await untrack(() => loadUser(id));
  let visits = $state.raw(user.visits);

  export function reset() {
    visits = 0;
  }

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }
</script>

<article class={["member", className]} {style} {...scopeAttributes(attributes)}>
  <h3>{user.name}</h3
  ><button type="button" onclick={() => visits++}>{user.name} visits: {visits}</button>
</article>
