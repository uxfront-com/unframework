import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import { isPlatformBrowser } from "@angular/common";
import {
  Component,
  Directive,
  ElementRef,
  Injector,
  type OnChanges,
  type OnDestroy,
  type OnInit,
  PLATFORM_ID,
  Renderer2,
  afterRenderEffect,
  computed,
  effect,
  inject,
  input,
  linkedSignal,
  output,
  signal,
  untracked,
  viewChild,
} from "@angular/core";

export interface BallotProps {
  limit: number;
  label?: string;
  choices: string[];
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
  selector: "uf-ballot",
  imports: [ScopeAttributes, Fallthrough],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let label = this.label();
    @let choices = this.choices();
    @let votes = this.votes();
    @let picked = this.picked();
    <section
      class="ballot"
      [attr.aria-label]="'aria-label' in (this.ufAttributes() ?? {}) ? this.ufAttributes()?.['aria-label'] : label"
      [class]="this.class()"
      [style]="this.style()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      [ufScope]="this.host"
      #ufElement
    >
      <p role="status">{{ votes }} votes left</p>
      <p>Picked: {{ picked }}</p>
      <ul aria-label="Choices">
        @for (choice of choices; track choice) {
          <li>
            <button type="button" (click)="vote(choice)">{{ choice }}</button>
          </li>
        }
      </ul>
      <button type="button" (click)="count()">Count the answers</button>
    </section>
  `,
})
export default class Ballot implements OnInit {
  readonly limit = input.required<number>();
  readonly label = input<string, string | undefined>("Vote", {
    transform: (value) => (value === undefined ? "Vote" : value),
  });
  readonly choices = input.required<string[]>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  readonly voted = output<[remaining: number, text: string]>();
  readonly moved = output<string>();
  readonly report = output<string>();
  readonly counted = output<number>();
  readonly ufElement = viewChild<ElementRef<HTMLElement>>("ufElement");
  private readonly injector = inject(Injector);
  protected readonly votes = linkedSignal(() => untracked(() => this.limit()));
  protected readonly picked = signal("none");
  private remaining!: number;
  private text!: string;
  private lastVotes!: number;

  constructor() {
    afterRenderEffect(() => {
      this.report.emit(this.describe());
    });
  }

  ngOnInit(): void {
    // Read once the inputs are set: these keep the values they start with.
    this.votes();
    this.remaining = this.limit();
    this.text = `${this.label()} (${this.limit()})`;
    this.lastVotes = this.votes();

    const currentValues = computed(
      () => [this.votes(), this.picked()] satisfies [unknown, unknown],
      { equal: (next, last) => next.every((value, index) => Object.is(value, last[index])) },
    );
    let lastValues = currentValues();
    effect(
      () => {
        const current = currentValues();
        if (Object.is(current, lastValues)) return;
        const [nextVotes, nextPicked]: [number, string] = current;
        const [lastCount, lastPick] = lastValues;
        lastValues = current;
        untracked(() => {
          this.moved.emit(`${lastPick}:${lastCount}>${nextPicked}:${nextVotes}`);
        });
      },
      { injector: this.injector },
    );
  }

  private isAnswer(value: string): value is "yes" | "no" {
    return value === "yes" || value === "no";
  }

  private describe(): string {
    const line = `${this.picked()} with ${this.votes()} left`;
    return line;
  }

  protected vote(choice: string) {
    if (this.remaining > 0) this.remaining -= 1;
    this.text = `${this.text}!`;
    this.lastVotes = this.votes();
    this.votes.update((votes) => votes - 1);
    this.picked.set(this.isAnswer(choice) ? choice : "other");
    this.voted.emit([this.remaining, `${this.text} ${this.lastVotes}`]);
  }

  protected count() {
    let answers = 0;
    this.choices().forEach((choice) => this.isAnswer(choice) && answers++);
    this.counted.emit(answers);
  }
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
