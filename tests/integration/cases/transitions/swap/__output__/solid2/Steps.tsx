import { Transition } from "./_unframework/Transition";
import { createState } from "./_unframework/createState";
import type { ComponentProps, JSX } from "@solidjs/web";
import { Match, Show, Switch, omit } from "solid-js";
import "./Steps.uf.tsx.css";

export default function Steps(
  props: Omit<ComponentProps<"section">, "class" | "style"> & {
    class?: string;
    style?: JSX.CSSProperties;
  },
) {
  const others = omit(props, "class");

  const [first, setFirst] = createState(true);
  const [step, setStep] = createState(1);

  return (
    <section
      class={props.class ? `steps ${props.class}` : "steps"}
      aria-label="Checkout"
      data-uf-84fe8ccf=""
      {...others}
    >
      <button type="button" onClick={() => setFirst(!first())} data-uf-84fe8ccf="">
        Swap
      </button>
      <Transition name="swap">
        <Show
          when={first()}
          fallback={
            <p class="card" data-uf-84fe8ccf="">
              Payment
            </p>
          }
        >
          <p class="card" data-uf-84fe8ccf="">
            Cart
          </p>
        </Show>
      </Transition>
      <button type="button" onClick={() => setStep((step() % 3) + 1)} data-uf-84fe8ccf="">
        Next
      </button>
      <Transition name="step">
        <Switch
          fallback={
            <p class="step" data-uf-84fe8ccf="">
              Step three
            </p>
          }
        >
          <Match when={step() === 1}>
            <p class="step" data-uf-84fe8ccf="">
              Step one
            </p>
          </Match>
          <Match when={step() === 2}>
            <p class="step" data-uf-84fe8ccf="">
              Step two
            </p>
          </Match>
        </Switch>
      </Transition>
    </section>
  );
}
