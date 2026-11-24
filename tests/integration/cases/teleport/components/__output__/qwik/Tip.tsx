import { teleport } from "./_unframework/teleport";
import { component$, useSignal, useVisibleTask$ } from "@qwik.dev/core";

export interface TipProps {
  label: string;
}

export default component$<TipProps>(({ label }) => {
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
          <p ref={teleport("body")} data-teleported="true" class="tip" role="note">
            {label} tip
          </p>
        </>
      )}
    </>
  );
});
