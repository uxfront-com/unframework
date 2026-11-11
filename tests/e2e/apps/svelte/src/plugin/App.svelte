<script lang="ts">
  import Button from "@unframework.dev/e2e-design-system/source/Button.uf.tsx";
  import Card from "@unframework.dev/e2e-design-system/source/Card.uf.tsx";
  import Counter from "@unframework.dev/e2e-design-system/source/Counter.uf.tsx";
  import TextField from "@unframework.dev/e2e-design-system/source/TextField.uf.tsx";
  import { useToggle } from "@unframework.dev/e2e-design-system/source/useToggle.uf.ts";

  import Greeting from "./Greeting.uf.tsx";
  import Hello from "./Hello.svelte";

  let presses = $state(0);
  let name = $state("");
  const toggle = useToggle(false);
</script>

<Hello />
<main>
  <Greeting name="Svelte" />
  <Button onpress={() => (presses += 1)}>Press me</Button>
  <p>Presses: {presses}</p>
  <Counter initial={2} step={3} />
  <TextField bind:value={name} label="Name" />
  <p>Name: {name}</p>
  <Card>
    {#snippet header()}<h2>Card header</h2>{/snippet}
    <button type="button" onclick={toggle.toggle}>Toggle card</button>
    {#snippet footer()}<p>{toggle.on ? "Open" : "Closed"}</p>{/snippet}
  </Card>
</main>
