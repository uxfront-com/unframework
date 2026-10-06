<script setup lang="ts">
export interface OrderStatusProps {
  status: "pending" | "shipped" | "delivered" | "cancelled";
  carrier?: string;
  eta?: string;
}

const { status, carrier = undefined, eta = undefined } = defineProps<OrderStatusProps>();
</script>

<template>
  <p class="order-status">
    <template v-if="status === 'pending'">Waiting for payment.</template>
    <template
      v-else-if="status === 'shipped'"
    ><strong>Shipped</strong> with {{ carrier ?? "our courier" }}, arriving {{ eta ?? "soon" }}.</template>
    <strong v-else-if="status === 'delivered'">Delivered</strong>
    <em v-else>Cancelled</em>
  </p>
</template>
