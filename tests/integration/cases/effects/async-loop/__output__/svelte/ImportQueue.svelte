<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import { tick, untrack } from "svelte";

  export interface ImportQueueProps {
    files: string[];
  }

  type Props = ImportQueueProps & { onprogress?: (status: string, attempts: number) => void };

  let { files, onprogress }: Props = $props();

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

<section class="import-queue" aria-label="Import">
  <button type="button" onclick={importAll}>Import all</button
  ><p role="status">{status}, {attempts} attempts</p>
</section>
