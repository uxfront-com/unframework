<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts" module>
  export interface TagProps {
    name: string;
  }
</script>

<script lang="ts">
  import { vMark } from "./vMark.svelte";
  import type { ClassValue } from "svelte/elements";

  type Props = TagProps & { class?: ClassValue; style?: string };

  let { name, class: className, style, ...attributes }: Props = $props();

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }
</script>

<em
  class={["tag", className]}
  {@attach vMark(() => `tag ${name}`)}
  {style}
  {...scopeAttributes(attributes)}
>#{name}</em>
