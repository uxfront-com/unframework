<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { ClassValue } from "svelte/elements";

  export interface UsageMeterProps {
    label: string;
    percent: number;
    colour: string;
    thickness: number;
  }

  type Props = UsageMeterProps & { class?: ClassValue; style?: string };

  let { label, percent, colour, thickness, class: className, style }: Props = $props();
</script>

<div class={["usage-meter", className]} {style}>
  <p
    style:color={colour}
    style:font-weight={700}
    style:line-height={1.5}
    style:margin-bottom="4px"
  >{label}: {percent}%</p
  ><div
    role="progressbar"
    aria-label={label}
    aria-valuemin="0"
    aria-valuemax="100"
    aria-valuenow={percent}
    style:--meter-colour={colour}
    style:--meter-value={percent}
    style:width="200px"
    style:height="12px"
    style:border-style="solid"
    style:border-width={`${thickness}px`}
    style:border-color={colour}
  >
    <div
      style:width={`${percent}%`}
      style:height="100%"
      style:background-color="var(--meter-colour)"
    ></div>
  </div
  ><p
    class="usage-meter-caption"
    style:color={colour}
    style:font-family={"\"UF Test Sans\", sans-serif"}
  >{percent} of 100 used</p>
</div>
