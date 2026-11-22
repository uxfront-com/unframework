<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import { loadUser } from "./api";
  import { untrack } from "svelte";
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<
    SvelteHTMLElements["section"],
    "id" | "prefix" | "children" | "class" | "style" | "ref"
  > & {
    id: string;
    prefix: string;
    class?: ClassValue;
    style?: string;
    ref?: HTMLElementTagNameMap["section"] | null;
  };

  let {
    id,
    prefix,
    class: className,
    style,
    ref = $bindable(null),
    ...attributes
  }: Props = $props();

  const user = await untrack(() => loadUser(prefix + id));
</script>

<section
  class={["greeting", className]}
  aria-label="Greeting"
  {style}
  bind:this={ref}
  {...attributes}
>
  <h2>Hello, {user.name}</h2
  ><p>Signed in as {id}</p>
</section>
