import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import { isPlatformBrowser } from "@angular/common";
import {
  Component,
  Directive,
  ElementRef,
  type OnChanges,
  type OnDestroy,
  PLATFORM_ID,
  Renderer2,
  inject,
  input,
  viewChild,
} from "@angular/core";

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

/** A native listener of each event a consumer passes, by the event's name (ADR-0118). */
type Listeners = { [K in keyof HTMLElementEventMap]?: (event: HTMLElementEventMap[K]) => void };

/**
 * Puts what a consumer passes the component, and the component does not declare, on the element
 * that takes it (ADR-0118): the attributes, the consumer's winning over the element's own, and
 * the native listeners, which run after the element's own.
 */
@Directive({ selector: "[ufFallthrough]" })
export class Fallthrough implements OnChanges, OnDestroy {
  readonly ufFallthrough = input.required<{
    attributes: Record<string, unknown> | undefined;
    listeners: Listeners | undefined;
  }>();
  private readonly element = inject<ElementRef<Element>>(ElementRef);
  private readonly renderer = inject(Renderer2);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly listening = new Map<string, { handler: unknown; stop: () => void }>();
  private written: Record<string, unknown> = {};

  ngOnChanges(): void {
    const element = this.element.nativeElement;
    const { attributes = {}, listeners = {} } = this.ufFallthrough();
    for (const name of Object.keys(this.written)) {
      if (!(name in attributes)) this.renderer.removeAttribute(element, name);
    }
    for (const [name, value] of Object.entries(attributes)) {
      if (value === null || value === undefined) this.renderer.removeAttribute(element, name);
      else this.renderer.setAttribute(element, name, String(value));
    }
    this.written = attributes;
    if (!this.browser) return;
    const handlers = new Map(Object.entries(listeners));
    for (const [event, { handler, stop }] of this.listening) {
      if (handlers.get(event) === handler) continue;
      stop();
      this.listening.delete(event);
    }
    for (const [event, handler] of handlers) {
      if (handler === undefined || this.listening.has(event)) continue;
      this.listening.set(event, { handler, stop: this.renderer.listen(element, event, handler) });
    }
  }

  ngOnDestroy(): void {
    for (const { stop } of this.listening.values()) stop();
  }
}

@Component({
  selector: "uf-account-summary",
  imports: [ScopeAttributes, Fallthrough],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let loading = this.loading();
    @let member = this.member();
    @let uptime = this.uptime();
    @let storage = this.storage();
    @let plan = this.plan();
    @let seats = this.seats();
    <section
      class="account-summary"
      aria-label="Account"
      [class]="this.class()"
      [style]="this.style()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      [ufScope]="this.host"
      #ufElement
    >
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
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  readonly ufElement = viewChild<ElementRef<HTMLElement>>("ufElement");
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
