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
  import type { ClassValue } from "svelte/elements";

  type Props = UploadStatusProps & { class?: ClassValue; style?: string };

  let {
    fileName,
    state,
    percent,
    steps,
    error,
    class: className,
    style,
    ...attributes
  }: Props = $props();

  function mergeStyle(
    own: Record<string, string | number | null | undefined>,
    consumer: string | undefined,
  ): string {
    const merged = { ...own };
    const text = consumer ?? "";
    const add = (declaration: string) => {
      const colon = declaration.indexOf(":");
      if (colon > 0)
        merged[declaration.slice(0, colon).trim()] = declaration.slice(colon + 1).trim();
    };
    let start = 0;
    let depth = 0;
    let quote = "";
    for (let index = 0; index < text.length; index++) {
      const char = text[index];
      if (quote) {
        if (char === "\\") index++;
        else if (char === quote) quote = "";
      } else if (char === "\\") index++;
      else if (char === "/" && text[index + 1] === "*") {
        const close = text.indexOf("*/", index + 2);
        index = close === -1 ? text.length : close + 1;
      } else if (char === '"' || char === "'") quote = char;
      else if (char === "(") depth++;
      else if (char === ")") depth--;
      else if (char === ";" && depth === 0) {
        add(text.slice(start, index));
        start = index + 1;
      }
    }
    add(text.slice(start));
    return Object.entries(merged)
      .map(([property, value]) => `${property}: ${value ?? ""}`)
      .join("; ");
  }

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }
</script>

<section
  class={["upload", `upload-${state}`, className]}
  aria-label={`Upload of ${fileName}`}
  style={mergeStyle({ color: state === "failed" ? "#8a1c1c" : "#1f3d5c", "--upload-percent": percent }, style)}
  {...scopeAttributes(attributes)}
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
