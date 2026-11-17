<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import Badge, { ToneKey } from "./Badge.svelte";
  import { loadUser } from "./api";
  import { type Snippet, setContext, untrack } from "svelte";
  import type { ClassValue } from "svelte/elements";

  type Props = { id: string; children?: Snippet; class?: ClassValue; style?: string };

  let { id, children, class: className, style, ...attributes }: Props = $props();

  setContext(ToneKey, "calm");

  const user = await untrack(() => loadUser(id));

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }
</script>

<section
  class={["panel", className]}
  aria-label={user.name}
  {style}
  {...scopeAttributes(attributes)}
><Badge />{@render children?.()}</section>
