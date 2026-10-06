<script setup lang="ts">
interface LabelAttributes {
  id: string;
  title?: string;
}

interface Parcel {
  label: string;
  tag?: LabelAttributes;
  seal?: LabelAttributes;
}

export interface ShipmentCardProps {
  reference: string;
  carrier: LabelAttributes | null;
  eta?: LabelAttributes | null;
  parcel: Parcel;
  tracked: boolean;
  tracking: LabelAttributes;
  stops: (LabelAttributes | undefined)[];
  signature?: LabelAttributes;
}

const {
  reference,
  carrier,
  eta = null,
  parcel,
  tracked,
  tracking,
  stops,
  signature = undefined,
} = defineProps<ShipmentCardProps>();
</script>

<template>
  <section class="shipment-card" :aria-label="reference">
    <p :id="carrier?.id" :title="carrier?.title">Carrier</p>
    <p :id="eta?.id" :title="eta?.title">Estimated delivery</p>
    <p :id="parcel.tag?.id" :title="parcel.tag?.title">{{ parcel.label }}</p>
    <p
      :id="(tracked ? tracking : undefined)?.id"
      :title="(tracked ? tracking : undefined)?.title"
    >Live tracking</p>
    <ol>
      <li
        v-for="(stop, index) in stops"
        :id="stop?.id"
        :key="index"
        :title="stop?.title"
      >Stop {{ index + 1 }}</li>
    </ol>
    <p v-if="signature" :id="signature.id" :title="signature.title">Signed on delivery</p>
    <p v-if="!parcel.seal">Not sealed</p>
    <p v-else :id="parcel.seal.id" :title="parcel.seal.title">Sealed</p>
  </section>
</template>
