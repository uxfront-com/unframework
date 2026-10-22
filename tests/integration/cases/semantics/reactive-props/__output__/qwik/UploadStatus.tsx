import { type CSSProperties, type ClassList, component$ } from "@qwik.dev/core";

export interface UploadStep {
  id: string;
  label: string;
}

export interface UploadStatusProps {
  fileName: string;
  state: "queued" | "uploading" | "failed";
  percent: number;
  steps: UploadStep[];
  error?: string;
}

export default component$<UploadStatusProps & { class?: ClassList; style?: CSSProperties }>(
  ({ fileName, state, percent, steps, error, class: className, style, ...attributes }) => {
    return (
      <section
        class={["upload", `upload-${state}`, className]}
        aria-label={`Upload of ${fileName}`}
        style={{
          color: state === "failed" ? "#8a1c1c" : "#1f3d5c",
          "--upload-percent": percent,
          ...style,
        }}
        {...scopeAttributes(attributes)}
      >
        <h2>{fileName}</h2>
        <div
          role="progressbar"
          aria-label="Upload progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
        >
          {percent}%
        </div>
        <>
          {state === "failed" ? (
            <p class="upload-error">{error ?? "The upload failed."}</p>
          ) : (
            <p>{state === "queued" ? "Waiting to start" : "Uploading"}</p>
          )}
        </>
        <ol>
          {steps.map((step) => (
            <li key={step.id}>{step.label}</li>
          ))}
        </ol>
      </section>
    );
  },
);

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const key of Object.keys(props)) {
    if (key.startsWith("data-uf-")) scope[key] = "";
  }
  return scope;
}
