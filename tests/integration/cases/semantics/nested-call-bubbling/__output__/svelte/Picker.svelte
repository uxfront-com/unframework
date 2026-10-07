<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import { tick } from "svelte";

  type Props = { ondone?: (step: number, status: string) => void };

  let { ondone }: Props = $props();

  let selected = $state("none");
  let hits = $state(0);
  let log = $state.raw<string[]>([]);
  let status = $state("idle");
  let step = $state(0);

  function record(line: string) {
    log = [...log, line];
  }

  function pick(name: string) {
    selected = name;
    hits += 1;
  }

  function report() {
    record(`picked ${selected} #${hits}`);
  }

  async function load() {
    status = "loading";
    await Promise.resolve();
    step += 1;
  }

  async function run() {
    step += 1;
    await load();
    status = `loaded ${step}`;
    await tick();
    ondone?.(step, status);
  }

  function start() {
    void run();
    status = "started";
  }
</script>

<section class="picker" aria-label="Picker">
  <div class="choices" role="presentation" onclick={report}>
    <button type="button" onclick={() => pick("alpha")}>Alpha</button
    ><button type="button" onclick={() => pick("beta")}>Beta</button>
  </div
  ><ol aria-label="Log">
    {#each log as entry, index (index)}
      <li>{entry}</li>
    {/each}
  </ol
  ><p role="status">{status}</p
  ><button type="button" onclick={start}>Start</button>
</section>
