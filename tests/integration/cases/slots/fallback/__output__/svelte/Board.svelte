<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import Notice from "./Notice.svelte";
  import type { ClassValue } from "svelte/elements";

  type Props = { build: string; class?: ClassValue; style?: string };

  let { build, class: className, style }: Props = $props();
</script>

<div class={className} {style}>
  <Notice
    label="Build"
  >Build {build} failed.{#snippet action()}<a href="#logs">See the logs</a>{/snippet}</Notice
  ><Notice label="Deploy" />
</div>
