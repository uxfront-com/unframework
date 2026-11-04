import { useClock } from "./use-clock";
import {
  Component,
  Directive,
  ElementRef,
  Injector,
  type OnDestroy,
  type OnInit,
  Renderer2,
  afterNextRender,
  inject,
  input,
  runInInjectionContext,
  signal,
} from "@angular/core";

/** The scope attributes taken off each host, for the roots its component renders later. */
const scopes = new WeakMap<Element, string[]>();

/**
 * Gives a root node of its component the scope attributes the component's styled parents put on
 * its host (ADR-0063), and takes them off the host, which keeps only `display: contents`.
 */
@Directive({ selector: "[ufScope]" })
export class ScopeAttributes implements OnInit {
  readonly ufScope = input.required<HTMLElement>();
  private readonly element = inject<ElementRef<Element>>(ElementRef);
  private readonly renderer = inject(Renderer2);

  ngOnInit(): void {
    const host = this.ufScope();
    let names = scopes.get(host);
    if (!names) {
      names = host.getAttributeNames().filter((name) => name.startsWith("data-uf-"));
      for (const name of names) this.renderer.removeAttribute(host, name);
      scopes.set(host, names);
    }
    for (const name of names) this.renderer.setAttribute(this.element.nativeElement, name, "");
  }
}

@Component({
  selector: "uf-clock",
  imports: [ScopeAttributes],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let ready = this.ready();
    @let started = this.clock.started();
    <p
      class="clock"
      [class]="this.class()"
      [style]="this.style()"
      [ufScope]="this.host"
    >{{ ready ? "Ready" : "Waiting" }}, {{ started ? "started" : "stopped" }}</p>
  `,
})
export default class Clock implements OnDestroy {
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  private readonly injector = inject(Injector);
  protected readonly ready = signal(false);
  private readonly clockInjector = Injector.create({ providers: [], parent: this.injector });
  protected readonly clock: ReturnType<typeof this.createClock>;

  constructor() {
    afterNextRender(() => {
      this.ready.set(true);
    });

    this.clock = runInInjectionContext(this.clockInjector, () => this.createClock());
  }

  ngOnDestroy(): void {
    this.clockInjector.destroy();
  }

  private createClock() {
    return useClock();
  }
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
