export default function Status({ busy, text, ...attributes }: { busy: boolean; text: string }) {
  return (
    <>
      {busy ? (
        <span className="badge" role="status" {...scopeAttributes(attributes)}>
          Saving
        </span>
      ) : (
        <button type="button" className="badge" {...scopeAttributes(attributes)}>
          {text}
        </button>
      )}
    </>
  );
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const key of Object.keys(props)) {
    if (key.startsWith("data-uf-")) scope[key] = "";
  }
  return scope;
}
