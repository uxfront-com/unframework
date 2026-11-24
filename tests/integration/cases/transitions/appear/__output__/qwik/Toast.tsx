import { type TransitionState, transition } from "./_unframework/transition";
import { component$, useConstant, useStyles$ } from "@qwik.dev/core";
import styles from "./Toast.uf.tsx.css?inline";

export default component$(() => {
  useStyles$(styles);

  const popState = useConstant((): TransitionState => ({ current: 0, elements: [], entering: [] }));

  return (
    <>
      <p class="toast" role="status" data-uf-acfe4ebf="" ref={transition(popState, "pop", 0, true)}>
        Saved
      </p>
    </>
  );
});
