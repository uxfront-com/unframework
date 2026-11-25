import { KeyedFor } from "./_unframework/KeyedFor";
import { cx } from "./_unframework/cx";
import { enumeratedValue } from "./_unframework/enumeratedValue";
import type { ComponentProps, JSX } from "@solidjs/web";
import { Match, Switch, omit } from "solid-js";

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

export default function UploadStatus(
  props: UploadStatusProps &
    Omit<
      ComponentProps<"section">,
      "fileName" | "state" | "percent" | "steps" | "error" | "class" | "style"
    > & { class?: string; style?: JSX.CSSProperties },
) {
  const others = omit(props, "fileName", "state", "percent", "steps", "error", "class", "style");

  return (
    <section
      class={cx("upload", `upload-${props.state}`, props.class)}
      aria-label={`Upload of ${props.fileName}`}
      style={{
        ...{
          color: props.state === "failed" ? "#8a1c1c" : "#1f3d5c",
          "--upload-percent": props.percent,
        },
        ...props.style,
      }}
      {...others}
    >
      <h2>{props.fileName}</h2>
      <div
        role="progressbar"
        aria-label="Upload progress"
        aria-valuemin="0"
        aria-valuemax="100"
        aria-valuenow={enumeratedValue(props.percent)}
      >
        {props.percent}%
      </div>
      <Switch>
        <Match when={props.state === "failed"}>
          <p class="upload-error">{props.error ?? "The upload failed."}</p>
        </Match>
        <Match when={props.state === "failed" ? undefined : { state: props.state }}>
          {(narrowed) => <p>{narrowed().state === "queued" ? "Waiting to start" : "Uploading"}</p>}
        </Match>
      </Switch>
      <ol>
        <KeyedFor each={props.steps} by={(step) => step.id}>
          {(step) => <li>{step.value.label}</li>}
        </KeyedFor>
      </ol>
    </section>
  );
}
