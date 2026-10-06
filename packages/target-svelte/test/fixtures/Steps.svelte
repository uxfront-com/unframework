<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  let { steps, score, label, mode }: {
    steps: string[];
    score: number;
    label: string;
    mode: string;
  } = $props();
</script>

<form>
  <ol>
    {#each steps as step, index (step)}
      <li {...{ value: steps.length - 1 - index }}>{step}</li>
    {/each}
  </ol
  ><meter min="0" max="10" {...{ value: score }} title={"Score \u0026 \"rank\""}>m</meter
  ><progress max="10" value={score}>p</progress><data {...{ value: label }}>d</data
  ><button type="button" {...{ value: label }}>b</button
  ><input type="checkbox" name="c" {...{ value: mode }} />
</form>
