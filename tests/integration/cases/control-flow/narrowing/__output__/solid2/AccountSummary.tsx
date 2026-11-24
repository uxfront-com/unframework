import { KeyedFor } from "./_unframework/KeyedFor";
import type { ComponentProps, JSX } from "@solidjs/web";
import { Match, Show, Switch, omit } from "solid-js";

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

export default function AccountSummary(
  props: AccountSummaryProps &
    Omit<
      ComponentProps<"section">,
      "loading" | "member" | "uptime" | "storage" | "plan" | "seats" | "class" | "style"
    > & { class?: string; style?: JSX.CSSProperties },
) {
  const others = omit(props, "loading", "member", "uptime", "storage", "plan", "seats", "class");

  return (
    <section
      class={props.class ? `account-summary ${props.class}` : "account-summary"}
      aria-label="Account"
      {...others}
    >
      <Switch>
        <Match when={props.loading}>
          <p>Loading the account</p>
        </Match>
        <Match when={!props.member}>
          <p>Signed out</p>
        </Match>
        <Match
          when={props.loading ? undefined : !props.member ? undefined : { member: props.member }}
        >
          {(narrowed) => <h2>{narrowed().member.name}</h2>}
        </Match>
      </Switch>
      <Show when={props.member}>{(member) => <p>Signed in as {member().email}</p>}</Show>
      <Show keyed when={props.member} fallback={<p>Role: guest</p>}>
        {(member) => <p>Role: {member.admin ? "administrator" : "member"}</p>}
      </Show>
      <Show when={props.member} fallback={<p>No profile</p>}>
        {(member) => <p>Profile of {member().name}</p>}
      </Show>
      <Show when={props.member && props.member.team ? { team: props.member.team } : undefined}>
        {(narrowed) => <p>Team: {narrowed().team.name}</p>}
      </Show>
      <Show when={props.uptime !== undefined ? { uptime: props.uptime } : undefined}>
        {(narrowed) => <p>Uptime {narrowed().uptime.toFixed(1)}%</p>}
      </Show>
      <Switch>
        <Match when={typeof props.storage === "number" ? { storage: props.storage } : undefined}>
          {(narrowed) => <p>Storage {narrowed().storage.toFixed(1)} GB</p>}
        </Match>
        <Match when={typeof props.storage === "number" ? undefined : { storage: props.storage }}>
          {(narrowed) => <p>Storage {narrowed().storage}</p>}
        </Match>
      </Switch>
      <Switch>
        <Match when={props.plan.kind === "paid" ? { plan: props.plan } : undefined}>
          {(narrowed) => <p>Renews on {narrowed().plan.renews}</p>}
        </Match>
        <Match when={props.plan.kind === "paid" ? undefined : { plan: props.plan }}>
          {(narrowed) => <p>Trial ends in {narrowed().plan.daysLeft} days</p>}
        </Match>
      </Switch>
      <ul aria-label="Seats">
        <KeyedFor each={props.seats} by={(seat, index) => index}>
          {(seat) => (
            <li>
              <Show when={seat.value} fallback="Vacant">
                {(seat_1) => <b>{seat_1().holder}</b>}
              </Show>
            </li>
          )}
        </KeyedFor>
      </ul>
    </section>
  );
}
