<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import { loadUser } from "./api";
  import { untrack } from "svelte";
  import type { ClassValue } from "svelte/elements";

  type Props = { id: string; class?: ClassValue; style?: string };

  let { id, class: className, style, ...attributes }: Props = $props();

  const user = await untrack(() => loadUser(id));

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }
</script>

<li class={["member", className]} {style} {...scopeAttributes(attributes)}>{user.name}</li>
