import { Button, Card, Counter, TextField, useToggle } from "@unframework/e2e-design-system/react";
import { useState } from "react";

export function Showcase() {
  const [presses, setPresses] = useState(0);
  const [name, setName] = useState("");
  const { on, toggle } = useToggle(false);
  return (
    <main>
      <Button onPress={() => setPresses(presses + 1)}>Press me</Button>
      <p>Presses: {presses}</p>
      <Counter initial={2} step={3} />
      <TextField label="Name" value={name} onValueChange={setName} />
      <p>Name: {name}</p>
      <Card header={<h2>Card header</h2>} footer={<p>{on ? "Open" : "Closed"}</p>}>
        <button type="button" onClick={toggle}>
          Toggle card
        </button>
      </Card>
    </main>
  );
}
