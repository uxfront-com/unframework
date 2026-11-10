<script lang="ts">
  import { Button, Card, Counter, TextField, useToggle } from "@unframework/e2e-design-system/svelte";

  let presses = $state(0);
  let name = $state("");
  const toggle = useToggle(false);
</script>

<main>
  <Button onpress={() => (presses += 1)}>Press me</Button>
  <p>Presses: {presses}</p>
  <Counter initial={2} step={3} />
  <TextField label="Name" bind:value={name} />
  <p>Name: {name}</p>
  <Card>
    {#snippet header()}
      <h2>Card header</h2>
    {/snippet}
    <button type="button" onclick={toggle.toggle}>Toggle card</button>
    {#snippet footer()}
      <p>{toggle.on ? "Open" : "Closed"}</p>
    {/snippet}
  </Card>
</main>
