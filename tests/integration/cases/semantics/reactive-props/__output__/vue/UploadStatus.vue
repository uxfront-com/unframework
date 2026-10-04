<script setup lang="ts">
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

const { fileName, state, percent, steps, error = undefined } = defineProps<UploadStatusProps>();
</script>

<template>
  <section
    class="upload"
    :class="`upload-${state}`"
    :aria-label="`Upload of ${fileName}`"
    :style="{ color: state === 'failed' ? '#8a1c1c' : '#1f3d5c', '--upload-percent': percent }"
  >
    <h2>{{ fileName }}</h2>
    <div
      role="progressbar"
      aria-label="Upload progress"
      aria-valuemin="0"
      aria-valuemax="100"
      :aria-valuenow="percent"
    >{{ percent }}%</div>
    <p v-if="state === 'failed'" class="upload-error">{{ error ?? "The upload failed." }}</p>
    <p v-else>{{ state === "queued" ? "Waiting to start" : "Uploading" }}</p>
    <ol>
      <li v-for="step in steps" :key="step.id">{{ step.label }}</li>
    </ol>
  </section>
</template>
