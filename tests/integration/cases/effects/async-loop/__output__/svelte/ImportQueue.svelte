<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import { tick, untrack } from "svelte";
  import type { ClassValue } from "svelte/elements";

  export interface ImportQueueProps {
    files: string[];
  }

  type Props = ImportQueueProps & {
    onprogress?: (status: string, attempts: number) => void;
    class?: ClassValue;
    style?: string;
  };

  let { files, onprogress, class: className, style, ...attributes }: Props = $props();

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

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }
</script>

<section
  class={["import-queue", className]}
  aria-label="Import"
  {style}
  {...scopeAttributes(attributes)}
>
  <button type="button" onclick={importAll}>Import all</button
  ><p role="status">{status}, {attempts} attempts</p>
</section>
