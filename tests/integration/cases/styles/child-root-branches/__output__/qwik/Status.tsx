import { scopeAttributes } from "./_unframework/scopeAttributes";
import { component$ } from "@qwik.dev/core";

export default component$<{ busy: boolean; text: string }>(({ busy, text, ...attributes }) => {
  return (
    <>
      {busy ? (
        <span class="badge" role="status" {...scopeAttributes(attributes)}>
          Saving
        </span>
      ) : (
        <button type="button" class="badge" {...scopeAttributes(attributes)}>
          {text}
        </button>
      )}
    </>
  );
});
