<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts" module>
  export const LocaleKey = Symbol("uf.locale") as symbol & { readonly __value: string };
</script>

<script lang="ts">
  import { type Snippet, setContext, untrack } from "svelte";
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<
    SvelteHTMLElements["div"],
    "locale" | "children" | "class" | "style" | "ref"
  > & {
    locale: string;
    children?: Snippet;
    class?: ClassValue;
    style?: string;
    ref?: HTMLElementTagNameMap["div"] | null;
  };

  let {
    locale,
    children,
    class: className,
    style,
    ref = $bindable(null),
    ...attributes
  }: Props = $props();

  setContext(
    LocaleKey,
    untrack(() => locale),
  );
</script>

<div
  lang={locale}
  class={className}
  {style}
  bind:this={ref}
  {...attributes}
>{@render children?.()}</div>
