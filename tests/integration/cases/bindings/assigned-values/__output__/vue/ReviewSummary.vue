<script setup lang="ts">
export interface ReviewSummaryProps {
  steps: string[];
  score: number;
  sku: string;
  product: string;
}

const { steps, score, sku, product } = defineProps<ReviewSummaryProps>();
</script>

<template>
  <section class="review-summary" aria-label="Review">
    <ol>
      <li v-for="(step, index) in steps" :key="step" :value="index">{{ step }}</li>
    </ol>
    <meter min="0" max="10" :value="score" aria-label="Score">{{ score }} out of 10</meter>
    <p>Product: <data :value="sku">{{ product }}</data></p>
  </section>
</template>
