<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts" module>
  export interface Theme {
    accent: string;
    label: string;
  }

  export const ThemeKey = Symbol("uf.theme") as symbol & { readonly __value: Theme };
</script>

<script lang="ts">
  import Badge from "./Badge.svelte";
  import { setContext } from "svelte";
  import type { ClassValue } from "svelte/elements";

  type Props = { class?: ClassValue; style?: string };

  let { class: className, style, ...attributes }: Props = $props();

  setContext(ThemeKey, { accent: "teal", label: "Teal" });

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }
</script>

<section aria-label="Themed" class={className} {style} {...scopeAttributes(attributes)}>
  <Badge text="New" />
</section>
