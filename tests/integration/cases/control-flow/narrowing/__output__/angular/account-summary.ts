import { Component, input } from "@angular/core";

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

@Component({
  selector: "uf-account-summary",
  host: { style: "display: contents" },
  preserveWhitespaces: false,
  template: `
    @let loading = this.loading();
    @let member = this.member();
    @let uptime = this.uptime();
    @let storage = this.storage();
    @let plan = this.plan();
    @let seats = this.seats();
    <section class="account-summary" aria-label="Account">
      @if (loading) {
        <p>Loading the account</p>
      } @else if (!member) {
        <p>Signed out</p>
      } @else {
        <h2>{{ member.name }}</h2>
      }
      @if (member) {
        <p>Signed in as {{ member.email }}</p>
      }
      @if (member) {
        <p>Role: {{ member.admin ? "administrator" : "member" }}</p>
      } @else {
        <p>Role: guest</p>
      }
      @if (!member) {
        <p>No profile</p>
      } @else {
        <p>Profile of {{ member.name }}</p>
      }
      @if (member && member.team) {
        <p>Team: {{ member.team.name }}</p>
      }
      @if (uptime !== undefined) {
        <p>Uptime {{ uptime.toFixed(1) }}%</p>
      }
      @if (typeof storage === "number") {
        <p>Storage {{ storage.toFixed(1) }} GB</p>
      } @else {
        <p>Storage {{ storage }}</p>
      }
      @if (plan.kind === "paid") {
        <p>Renews on {{ plan.renews }}</p>
      } @else {
        <p>Trial ends in {{ plan.daysLeft }} days</p>
      }
      <ul aria-label="Seats">
        @for (seat of seats; track index; let index = $index) {
          <li>
            @if (seat) {<b>{{ seat.holder }}</b>} @else {Vacant}
          </li>
        }
      </ul>
    </section>
  `,
})
export default class AccountSummary {
  readonly loading = input.required<boolean>();
  readonly member = input<Member>();
  readonly uptime = input<number>();
  readonly storage = input.required<number | string>();
  readonly plan = input.required<Plan>();
  readonly seats = input.required<(Seat | null)[]>();
}
