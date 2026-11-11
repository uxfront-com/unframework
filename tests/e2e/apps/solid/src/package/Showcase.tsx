import { Button, Card, Counter, TextField, useToggle } from "@unframework.dev/e2e-design-system/solid";
import { createSignal } from "solid-js";

export function Showcase() {
  const [presses, setPresses] = createSignal(0);
  const [name, setName] = createSignal("");
  const { on, toggle } = useToggle(false);
  return (
    <main>
      <Button onPress={() => setPresses(presses() + 1)}>Press me</Button>
      <p>Presses: {presses()}</p>
      <Counter initial={2} step={3} />
      <TextField label="Name" value={name()} onValueChange={setName} />
      <p>Name: {name()}</p>
      <Card header={<h2>Card header</h2>} footer={<p>{on() ? "Open" : "Closed"}</p>}>
        <button type="button" onClick={toggle}>
          Toggle card
        </button>
      </Card>
    </main>
  );
}
