<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import Notice from "./Notice.svelte";
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<SvelteHTMLElements["div"], "build" | "children" | "class" | "style" | "ref"> & {
    build: string;
    class?: ClassValue;
    style?: string;
    ref?: HTMLElementTagNameMap["div"] | null;
  };

  let { build, class: className, style, ref = $bindable(null), ...attributes }: Props = $props();
</script>

<div class={className} {style} bind:this={ref} {...attributes}>
  <Notice
    label="Build"
  >Build {build} failed.{#snippet action()}<a href="#logs">See the logs</a>{/snippet}</Notice
  ><Notice label="Deploy" />
</div>
