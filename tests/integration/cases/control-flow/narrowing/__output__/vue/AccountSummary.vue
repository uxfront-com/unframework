<script setup lang="ts">
interface Team {
  name: string;
}

interface Member {
  name: string;
  email: string;
  admin: boolean;
  team?: Team;
}

interface Seat {
  holder: string;
}

type Plan = { kind: "paid"; renews: string } | { kind: "trial"; daysLeft: number };

export interface AccountSummaryProps {
  loading: boolean;
  member?: Member;
  uptime?: number;
  storage: number | string;
  plan: Plan;
  seats: (Seat | null)[];
}

const {
  loading,
  member = undefined,
  uptime = undefined,
  storage,
  plan,
  seats,
} = defineProps<AccountSummaryProps>();
</script>

<template>
  <section class="account-summary" aria-label="Account">
    <p v-if="loading">Loading the account</p>
    <p v-else-if="!member">Signed out</p>
    <h2 v-else>{{ member.name }}</h2>
    <p v-if="member">Signed in as {{ member.email }}</p>
    <p v-if="member">Role: {{ member.admin ? "administrator" : "member" }}</p>
    <p v-else>Role: guest</p>
    <p v-if="!member">No profile</p>
    <p v-else>Profile of {{ member.name }}</p>
    <p v-if="member && member.team">Team: {{ member.team.name }}</p>
    <p v-if="uptime !== undefined">Uptime {{ uptime.toFixed(1) }}%</p>
    <p v-if="typeof storage === 'number'">Storage {{ storage.toFixed(1) }} GB</p>
    <p v-else>Storage {{ storage }}</p>
    <p v-if="plan.kind === 'paid'">Renews on {{ plan.renews }}</p>
    <p v-else>Trial ends in {{ plan.daysLeft }} days</p>
    <ul aria-label="Seats">
      <li v-for="(seat, index) in seats" :key="index">
        <b v-if="seat">{{ seat.holder }}</b>
        <template v-else>Vacant</template>
      </li>
    </ul>
  </section>
</template>
