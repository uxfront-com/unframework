// A child whose root is a conditional: whichever branch renders takes its styled parent's scope
// attribute, as Vue's fallthrough gives it to the rendered root.
export default function Status({ busy, text }: { busy: boolean; text: string }) {
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
}
