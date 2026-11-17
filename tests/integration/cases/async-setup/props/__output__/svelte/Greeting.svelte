<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import { loadUser } from "./api";
  import { untrack } from "svelte";
  import type { ClassValue } from "svelte/elements";

  type Props = { id: string; prefix: string; class?: ClassValue; style?: string };

  let { id, prefix, class: className, style, ...attributes }: Props = $props();

  const user = await untrack(() => loadUser(prefix + id));

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }
</script>

<section
  class={["greeting", className]}
  aria-label="Greeting"
  {style}
  {...scopeAttributes(attributes)}
>
  <h2>Hello, {user.name}</h2
  ><p>Signed in as {id}</p>
</section>
