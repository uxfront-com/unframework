import Button from "@unframework.dev/e2e-design-system/source/Button.uf.tsx";
import Card from "@unframework.dev/e2e-design-system/source/Card.uf.tsx";
import Counter from "@unframework.dev/e2e-design-system/source/Counter.uf.tsx";
import TextField from "@unframework.dev/e2e-design-system/source/TextField.uf.tsx";
import { useToggle } from "@unframework.dev/e2e-design-system/source/useToggle.uf.ts";
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
