import { $, component$, useSignal } from "@qwik.dev/core";
import {
  Button,
  Card,
  Counter,
  TextField,
  useToggle,
} from "@unframework.dev/e2e-design-system/qwik";

export const Showcase = component$(() => {
  const presses = useSignal(0);
  const name = useSignal("");
  const { on, toggle } = useToggle(false);
  return (
    <main>
      <Button onPress$={$(() => presses.value++)}>Press me</Button>
      <p>Presses: {presses.value}</p>
      <Counter initial={2} step={3} />
      <TextField
        label="Name"
        value={name.value}
        onValueChange$={$((value: string) => (name.value = value))}
      />
      <p>Name: {name.value}</p>
      <Card
        header$={$(() => (
          <h2>Card header</h2>
        ))}
        footer$={$(() => (
          <p>{on.value ? "Open" : "Closed"}</p>
        ))}
      >
        <button type="button" onClick$={toggle}>
          Toggle card
        </button>
      </Card>
    </main>
  );
});
