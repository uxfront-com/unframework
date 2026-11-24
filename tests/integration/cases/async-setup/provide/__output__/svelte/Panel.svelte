<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import Badge, { ToneKey } from "./Badge.svelte";
  import { loadUser } from "./api";
  import { type Snippet, setContext, untrack } from "svelte";
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<
    SvelteHTMLElements["section"],
    "id" | "children" | "class" | "style" | "ref"
  > & {
    id: string;
    children?: Snippet;
    class?: ClassValue;
    style?: string;
    ref?: HTMLElementTagNameMap["section"] | null;
  };

  let {
    id,
    children,
    class: className,
    style,
    ref = $bindable(null),
    ...attributes
  }: Props = $props();

  setContext(ToneKey, "calm");

  const user = await untrack(() => loadUser(id));
</script>

<section
  class={["panel", className]}
  aria-label={user.name}
  {style}
  bind:this={ref}
  {...attributes}
><Badge />{@render children?.()}</section>
