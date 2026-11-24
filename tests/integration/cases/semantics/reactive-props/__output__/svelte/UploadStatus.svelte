<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts" module>
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
</script>

<script lang="ts">
  import { mergeStyle } from "./_unframework/mergeStyle";
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<
    SvelteHTMLElements["section"],
    "fileName" | "state" | "percent" | "steps" | "error" | "children" | "class" | "style" | "ref"
  > &
    UploadStatusProps & {
      class?: ClassValue;
      style?: string;
      ref?: HTMLElementTagNameMap["section"] | null;
    };

  let {
    fileName,
    state,
    percent,
    steps,
    error,
    class: className,
    style,
    ref = $bindable(null),
    ...attributes
  }: Props = $props();
</script>

<section
  class={["upload", `upload-${state}`, className]}
  aria-label={`Upload of ${fileName}`}
  style={mergeStyle({ color: state === "failed" ? "#8a1c1c" : "#1f3d5c", "--upload-percent": percent }, style)}
  bind:this={ref}
  {...attributes}
>
  <h2>{fileName}</h2
  ><div
    role="progressbar"
    aria-label="Upload progress"
    aria-valuemin="0"
    aria-valuemax="100"
    aria-valuenow={percent}
  >{percent}%</div
  >{#if state === "failed"}
    <p class="upload-error">{error ?? "The upload failed."}</p>
  {:else}
    <p>{state === "queued" ? "Waiting to start" : "Uploading"}</p>
  {/if}<ol>
    {#each steps as step (step.id)}
      <li>{step.label}</li>
    {/each}
  </ol>
</section>
