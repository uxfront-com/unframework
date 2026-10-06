import { For, Match, Show, Switch } from "solid-js";

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

export default function AccountSummary(props: AccountSummaryProps) {
  return (
    <section class="account-summary" aria-label="Account">
      <Switch>
        <Match when={props.loading}>
          <p>Loading the account</p>
        </Match>
        <Match when={!props.member}>
          <p>Signed out</p>
        </Match>
        <Match
          keyed
          when={props.loading ? undefined : !props.member ? undefined : { member: props.member }}
        >
          {({ member }) => <h2>{member.name}</h2>}
        </Match>
      </Switch>
      <Show keyed when={props.member}>
        {(member) => <p>Signed in as {member.email}</p>}
      </Show>
      <Show keyed when={props.member} fallback={<p>Role: guest</p>}>
        {(member) => <p>Role: {member.admin ? "administrator" : "member"}</p>}
      </Show>
      <Show keyed when={props.member} fallback={<p>No profile</p>}>
        {(member) => <p>Profile of {member.name}</p>}
      </Show>
      <Show
        keyed
        when={props.member && props.member.team ? { team: props.member.team } : undefined}
      >
        {({ team }) => <p>Team: {team.name}</p>}
      </Show>
      <Show keyed when={props.uptime !== undefined ? { uptime: props.uptime } : undefined}>
        {({ uptime }) => <p>Uptime {uptime.toFixed(1)}%</p>}
      </Show>
      <Switch>
        <Match
          keyed
          when={typeof props.storage === "number" ? { storage: props.storage } : undefined}
        >
          {({ storage }) => <p>Storage {storage.toFixed(1)} GB</p>}
        </Match>
        <Match
          keyed
          when={typeof props.storage === "number" ? undefined : { storage: props.storage }}
        >
          {({ storage }) => <p>Storage {storage}</p>}
        </Match>
      </Switch>
      <Switch>
        <Match keyed when={props.plan.kind === "paid" ? { plan: props.plan } : undefined}>
          {({ plan }) => <p>Renews on {plan.renews}</p>}
        </Match>
        <Match keyed when={props.plan.kind === "paid" ? undefined : { plan: props.plan }}>
          {({ plan }) => <p>Trial ends in {plan.daysLeft} days</p>}
        </Match>
      </Switch>
      <ul aria-label="Seats">
        <For each={props.seats}>
          {(seat) => (
            <li>
              <Show keyed when={seat} fallback="Vacant">
                {(seat) => <b>{seat.holder}</b>}
              </Show>
            </li>
          )}
        </For>
      </ul>
    </section>
  );
}
