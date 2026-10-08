<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import { tick } from "svelte";

  type Props = { onsaved?: (attempt: number, status: string) => void };

  let { onsaved }: Props = $props();

  let status = $state("Not saved");
  let attempts = $state(0);

  async function save() {
    status = "Saving";
    attempts += 1;
    await Promise.resolve();
    status = "Checking";
    await tick();
    status = `Saved, attempt ${attempts}`;
    onsaved?.(attempts, status);
  }
</script>

<section class="save-draft" aria-label="Draft">
  <p role="status">{status}</p
  ><button type="button" onclick={save}>Save the draft</button>
</section>
