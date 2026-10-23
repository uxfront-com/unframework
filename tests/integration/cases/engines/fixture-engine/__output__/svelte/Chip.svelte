<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { ClassValue } from "svelte/elements";
  import { chip } from "virtual:fixture-engine";
  import "virtual:fixture-engine.css";

  type Props = { label: string; tone?: "plain" | "accent"; class?: ClassValue; style?: string };

  let { label, tone, class: className, style, ...attributes }: Props = $props();

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }
</script>

<span class={[chip(tone), className]} {style} {...scopeAttributes(attributes)}>{label}</span>
