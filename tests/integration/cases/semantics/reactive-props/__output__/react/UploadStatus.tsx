import type { CSSProperties } from "react";

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

export default function UploadStatus({
  fileName,
  state,
  percent,
  steps,
  error,
}: UploadStatusProps) {
  return (
    <section
      className={cx("upload", `upload-${state}`)}
      aria-label={`Upload of ${fileName}`}
      style={
        {
          color: state === "failed" ? "#8a1c1c" : "#1f3d5c",
          "--upload-percent": percent,
        } as CSSProperties
      }
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
      {state === "failed" ? (
        <p className="upload-error">{error ?? "The upload failed."}</p>
      ) : (
        <p>{state === "queued" ? "Waiting to start" : "Uploading"}</p>
      )}
      <ol>
        {steps.map((step) => (
          <li key={step.id}>{step.label}</li>
        ))}
      </ol>
    </section>
  );
}

/** Joins class names, and the keys of an object's truthy entries, into one `className`. */
function cx(...parts: unknown[]): string {
  const names: string[] = [];
  for (const part of parts) {
    if (typeof part === "string") {
      if (part) names.push(part);
    } else if (part && typeof part === "object") {
      for (const [key, on] of Object.entries(part)) {
        if (on) names.push(key);
      }
    }
  }
  return names.join(" ");
}
