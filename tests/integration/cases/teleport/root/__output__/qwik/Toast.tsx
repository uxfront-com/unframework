import { teleport } from "./_unframework/teleport";
import { component$, useSignal, useStyles$, useVisibleTask$ } from "@qwik.dev/core";
import styles from "./Toast.uf.tsx.css?inline";

export interface ToastProps {
  message: string;
}

export default component$<ToastProps>(({ message }) => {
  useStyles$(styles);

  const mounted = useSignal(false);
  useVisibleTask$(
    () => {
      mounted.value = true;
    },
    { strategy: "document-ready" },
  );

  return (
    <>
      {mounted.value && (
        <>
          {""}
          <div
            ref={teleport("body")}
            data-teleported="true"
            class="toast"
            role="alert"
            data-uf-416dbabb=""
          >
            <p data-uf-416dbabb="">{message}</p>
          </div>
        </>
      )}
    </>
  );
});
