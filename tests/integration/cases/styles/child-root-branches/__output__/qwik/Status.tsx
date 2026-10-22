import { component$ } from "@qwik.dev/core";

export default component$<{ busy: boolean; text: string }>(({ busy, text }) => {
  return (
    <>
      {busy ? (
        <span class="badge" role="status">
          Saving
        </span>
      ) : (
        <button type="button" class="badge">
          {text}
        </button>
      )}
    </>
  );
});
