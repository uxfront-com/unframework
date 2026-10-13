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
  ({ fileName, state, percent, steps, error, class: className, style }) => {
    return (
      <section
        class={["upload", `upload-${state}`, className]}
        aria-label={`Upload of ${fileName}`}
        style={{
          color: state === "failed" ? "#8a1c1c" : "#1f3d5c",
          "--upload-percent": percent,
          ...style,
        }}
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
