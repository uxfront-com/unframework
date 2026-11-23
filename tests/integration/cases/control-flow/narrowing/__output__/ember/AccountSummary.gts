import Component from "@glimmer/component";
import { htmlSafe, isHTMLSafe, type SafeString } from "@ember/template";

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

export interface AccountSummarySignature {
  Args: AccountSummaryProps & { style?: unknown };
  Element: HTMLElementTagNameMap["section"];
}

export default class AccountSummary extends Component<AccountSummarySignature> {
  get value1() {
    return !this.args.member;
  }

  get value2() {
    return !!this.args.member ? this.args.member.name : undefined;
  }

  get value3() {
    return this.args.member ? (this.args.member.admin ? "administrator" : "member") : undefined;
  }

  get value4() {
    return this.args.member && this.args.member.team;
  }

  get value5() {
    return this.args.member && this.args.member.team ? this.args.member.team.name : undefined;
  }

  get value6() {
    return this.args.uptime !== undefined;
  }

  get value7() {
    return this.args.uptime !== undefined ? this.args.uptime.toFixed(1) : undefined;
  }

  get value8() {
    return typeof this.args.storage === "number";
  }

  get value9() {
    return typeof this.args.storage === "number" ? this.args.storage.toFixed(1) : undefined;
  }

  get value10() {
    return !(typeof this.args.storage === "number") ? this.args.storage : undefined;
  }

  get value11() {
    return this.args.plan.kind === "paid";
  }

  get value12() {
    return this.args.plan.kind === "paid" ? this.args.plan.renews : undefined;
  }

  get value13() {
    return !(this.args.plan.kind === "paid") ? this.args.plan.daysLeft : undefined;
  }

  <template><section
      class="account-summary"
      aria-label="Account"
      style={{fallthroughStyle @style}}
      ...attributes
    >{{#if @loading}}<p>Loading the account</p>{{else if this.value1}}<p>Signed out</p>{{else}}<h2>{{this.value2}}</h2>{{/if}}{{#if @member}}<p>Signed in as {{@member.email}}</p>{{/if}}{{#if @member}}<p>Role: {{this.value3}}</p>{{else}}<p>Role: guest</p>{{/if}}{{#if this.value1}}<p>No profile</p>{{else}}<p>Profile of {{this.value2}}</p>{{/if}}{{#if this.value4}}<p>Team: {{this.value5}}</p>{{/if}}{{#if this.value6}}<p>Uptime {{this.value7}}%</p>{{/if}}{{#if this.value8}}<p>Storage {{this.value9}} GB</p>{{else}}<p>Storage {{this.value10}}</p>{{/if}}{{#if this.value11}}<p>Renews on {{this.value12}}</p>{{else}}<p>Trial ends in {{this.value13}} days</p>{{/if}}<ul
      aria-label="Seats"
    >{{#each @seats key="@index" as |seat|}}<li>{{#if seat}}<b>{{seat.holder}}</b>{{else}}Vacant{{/if}}</li>{{/each}}</ul></section></template>
}

/**
 * Vue's merge of a caller's style into the root's, marked safe: each style's declarations in
 * order, where a later value of a property replaces an earlier one, and a nullish one removes it.
 * A style is text, or a list of `[property, value]` declarations, where one without a property
 * is a whole style.
 */
function fallthroughStyle(...styles: unknown[]): SafeString | undefined {
  const merged = new Map<string, unknown>();
  const add = (style: unknown): void => {
    if (style === undefined || style === null) return;
    if (Array.isArray(style)) {
      for (const [property, value] of style as [string, unknown][]) {
        if (property) merged.set(property, value);
        else add(value);
      }
    } else if (typeof style === "object" && !isHTMLSafe(style)) {
      for (const [key, value] of Object.entries(style)) {
        merged.set(
          key.startsWith("--")
            ? key
            : key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`),
          value,
        );
      }
    } else {
      const text = String(style).replace(/\/\*[^]*?\*\//g, "");
      for (const declaration of text.split(/;(?![^(]*\))/)) {
        const [property, value] = declaration.split(/:([^]+)/);
        if (property?.trim() && value?.trim()) merged.set(property.trim(), value.trim());
      }
    }
  };
  for (const style of styles) add(style);
  const text = Array.from(merged)
    .flatMap(([property, value]) =>
      value === undefined || value === null ? [] : [`${property}: ${String(value)}`],
    )
    .join("; ");
  return text ? htmlSafe(text) : undefined;
}
