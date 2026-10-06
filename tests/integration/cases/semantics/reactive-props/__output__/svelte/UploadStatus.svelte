<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
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

  let { fileName, state, percent, steps, error }: UploadStatusProps = $props();
</script>

<section
  class={["upload", `upload-${state}`]}
  aria-label={`Upload of ${fileName}`}
  style:color={state === "failed" ? "#8a1c1c" : "#1f3d5c"}
  style:--upload-percent={percent}
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
