<script setup lang="ts">
export interface UsageMeterProps {
  label: string;
  percent: number;
  colour: string;
  thickness: number;
}

const { label, percent, colour, thickness } = defineProps<UsageMeterProps>();
</script>

<template>
  <div class="usage-meter">
    <p
      style="margin-bottom: 4px"
      :style="{ color: colour, fontWeight: 700, lineHeight: 1.5 }"
    >{{ label }}: {{ percent }}%</p>
    <div
      role="progressbar"
      :aria-label="label"
      aria-valuemin="0"
      aria-valuemax="100"
      :aria-valuenow="percent"
      style="width: 200px; height: 12px; border-style: solid"
      :style="{ '--meter-colour': colour, '--meter-value': percent, borderWidth: `${thickness}px`, borderColor: colour }"
    >
      <div
        style="height: 100%; background-color: var(--meter-colour)"
        :style="{ width: `${percent}%` }"
      ></div>
    </div>
    <p
      class="usage-meter-caption"
      style="font-family: &quot;UF Test Sans&quot;, sans-serif"
      :style="{ color: colour }"
    >{{ percent }} of 100 used</p>
  </div>
</template>
