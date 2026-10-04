import { For, Show } from "solid-js";

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

export default function UploadStatus(props: UploadStatusProps) {
  return (
    <section
      class={cx("upload", `upload-${props.state}`)}
      aria-label={`Upload of ${props.fileName}`}
      style={{
        color: props.state === "failed" ? "#8a1c1c" : "#1f3d5c",
        "--upload-percent": props.percent,
      }}
    >
      <h2>{props.fileName}</h2>
      <div
        role="progressbar"
        aria-label="Upload progress"
        aria-valuemin="0"
        aria-valuemax="100"
        aria-valuenow={props.percent}
      >
        {props.percent}%
      </div>
      <Show
        when={props.state === "failed"}
        fallback={<p>{props.state === "queued" ? "Waiting to start" : "Uploading"}</p>}
      >
        <p class="upload-error">{props.error ?? "The upload failed."}</p>
      </Show>
      <ol>
        <For each={props.steps}>{(step) => <li>{step.label}</li>}</For>
      </ol>
    </section>
  );
}

/** Joins class names: strings as they are, and the names of an object's truthy entries. */
function cx(...parts: unknown[]): string {
  const names: string[] = [];
  for (const part of parts) {
    if (typeof part === "string") names.push(part);
    else if (part && typeof part === "object") {
      for (const [name, on] of Object.entries(part)) if (on) names.push(name);
    }
  }
  return names.join(" ");
}
