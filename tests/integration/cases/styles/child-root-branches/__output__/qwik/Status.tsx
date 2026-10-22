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

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const key of Object.keys(props)) {
    if (key.startsWith("data-uf-")) scope[key] = "";
  }
  return scope;
}
