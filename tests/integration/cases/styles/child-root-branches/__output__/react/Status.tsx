import { scopeAttributes } from "./_unframework/scopeAttributes";

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
