import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import { loadTeam, loadUser } from "./api";
import { isPlatformBrowser } from "@angular/common";
import {
  Component,
  DestroyRef,
  Directive,
  ElementRef,
  type OnChanges,
  type OnDestroy,
  type OnInit,
  PLATFORM_ID,
  PendingTasks,
  Renderer2,
  computed,
  inject,
  input,
  signal,
  viewChild,
} from "@angular/core";

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
  selector: "uf-membership",
  imports: [ScopeAttributes, Fallthrough],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @if (resolved()) {
      @let summary = this.summary();
      <p
        class="membership"
        role="status"
        [class]="this.class()"
        [style]="this.style()"
        [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
        [ufScope]="this.host"
        #ufElement
      >{{ summary }}</p>
    }
  `,
})
export default class Membership implements OnInit {
  readonly id = input.required<string>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  readonly ufElement = viewChild<ElementRef<HTMLParagraphElement>>("ufElement");
  private readonly pendingTasks = inject(PendingTasks);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly resolved = signal(false);
  private user!: Awaited<ReturnType<typeof this.initialUser>>;
  private team!: Awaited<ReturnType<typeof this.initialTeam>>;
  protected readonly summary = computed(() => `${this.user.name} is in ${this.team.name}`);

  ngOnInit(): void {
    this.pendingTasks.run(async () => {
      this.user = await this.initialUser();
      this.team = await this.initialTeam();

      // Destroyed while it waited: the rest of the setup never runs.
      if (this.destroyRef.destroyed) return;

      this.resolved.set(true);
    });
  }

  private initialUser() {
    return loadUser(this.id());
  }

  private initialTeam() {
    return loadTeam(this.user.teamId);
  }
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
