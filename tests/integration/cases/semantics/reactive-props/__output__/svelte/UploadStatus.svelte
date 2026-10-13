<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { ClassValue } from "svelte/elements";

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

  type Props = UploadStatusProps & { class?: ClassValue; style?: string };

  let { fileName, state, percent, steps, error, class: className, style }: Props = $props();

  function mergeStyle(
    own: Record<string, string | number | null | undefined>,
    consumer: string | undefined,
  ): string {
    const merged = { ...own };
    for (const declaration of (consumer ?? "").split(/;(?![^(]*\))/)) {
      const colon = declaration.indexOf(":");
      if (colon > 0)
        merged[declaration.slice(0, colon).trim()] = declaration.slice(colon + 1).trim();
    }
    return Object.entries(merged)
      .flatMap(([property, value]) =>
        value == null || value === "" ? [] : [`${property}: ${value}`],
      )
      .join("; ");
  }
</script>

<section
  class={["upload", `upload-${state}`, className]}
  aria-label={`Upload of ${fileName}`}
  style={mergeStyle({ color: state === "failed" ? "#8a1c1c" : "#1f3d5c", "--upload-percent": percent }, style)}
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
