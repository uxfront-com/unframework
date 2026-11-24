import { Fallthrough } from "./_unframework/Fallthrough";
import type { Listeners } from "./_unframework/Listeners";
import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import { useClock } from "./use-clock";
import {
  Component,
  ElementRef,
  Injector,
  type OnDestroy,
  afterNextRender,
  inject,
  input,
  runInInjectionContext,
  signal,
  viewChild,
} from "@angular/core";

@Component({
  selector: "uf-clock",
  imports: [ScopeAttributes, Fallthrough],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let ready = this.ready();
    @let started = this.clock.started();
    <p
      class="clock"
      [class]="this.class()"
      [style]="this.style()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      [ufScope]="this.host"
      #ufElement
    >{{ ready ? "Ready" : "Waiting" }}, {{ started ? "started" : "stopped" }}</p>
  `,
})
export default class Clock implements OnDestroy {
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  readonly ufElement = viewChild<ElementRef<HTMLParagraphElement>>("ufElement");
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
