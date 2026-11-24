<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts" module>
  export interface ImportQueueProps {
    files: string[];
  }
</script>

<script lang="ts">
  import { tick, untrack } from "svelte";
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<
    SvelteHTMLElements["section"],
    "files" | "onprogress" | "children" | "class" | "style" | "ref"
  > &
    ImportQueueProps & {
      onprogress?: (status: string, attempts: number) => void;
      class?: ClassValue;
      style?: string;
      ref?: HTMLElementTagNameMap["section"] | null;
    };

  let {
    files,
    onprogress,
    class: className,
    style,
    ref = $bindable(null),
    ...attributes
  }: Props = $props();

  let status = $state("idle");
  let attempts = $state(0);

  let previousStatusAttempts = untrack((): [typeof status, typeof attempts] => [status, attempts]);
  $effect.pre(() => {
    const values: [typeof status, typeof attempts] = [status, attempts];
    if (values.every((value, index) => Object.is(value, previousStatusAttempts[index]))) return;
    previousStatusAttempts = values;
    untrack(() => {
      const [nextStatus, nextAttempts] = values;
      onprogress?.(nextStatus, nextAttempts);
    });
  });

  async function importAll() {
    status = "starting";
    for (const file of files) {
      attempts += 1;
      await tick();
      status = `imported ${file}`;
    }
    status = "done";
  }
</script>

<section
  class={["import-queue", className]}
  aria-label="Import"
  {style}
  bind:this={ref}
  {...attributes}
>
  <button type="button" onclick={importAll}>Import all</button
  ><p role="status">{status}, {attempts} attempts</p>
</section>
