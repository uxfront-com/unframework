<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import { CountKey } from "./Counter.svelte";
  import { getContext, hasContext } from "svelte";
  import type { ClassValue } from "svelte/elements";

  type Props = { class?: ClassValue; style?: string };

  let { class: className, style, ...attributes }: Props = $props();

  let none = $state(0);
  const count = hasContext(CountKey)
    ? getContext<(typeof CountKey)["__value"]>(CountKey)
    : refObject(() => none);

  function refObject<T>(get: () => T): { readonly value: T } {
    return {
      get value() {
        return get();
      },
    };
  }

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }
</script>

<output class={className} {style} {...scopeAttributes(attributes)}>Count: {count.value}</output>
