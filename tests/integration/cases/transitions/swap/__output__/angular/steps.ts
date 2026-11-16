import {
  type AnimationCallbackEvent,
  Component,
  DestroyRef,
  Directive,
  ElementRef,
  type OnInit,
  Renderer2,
  ViewEncapsulation,
  afterNextRender,
  inject,
  input,
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

/** A transition's conditional: the branch it shows, and whether it has rendered once. */
@Directive({ selector: "ng-container[ufTransitionRegion]" })
export class TransitionRegion {
  readonly ufTransitionRegion = input.required<number>();
  ready = false;

  constructor() {
    afterNextRender(() => {
      this.ready = true;
    });
  }
}

/** Runs Vue's transition classes of `ufTransition` on its element as it enters and leaves. */
@Directive({ selector: "[ufTransition]", exportAs: "ufTransition" })
export class Transition implements OnInit {
  readonly ufTransition = input.required<string>();
  readonly ufTransitionAppear = input(false);
  readonly ufTransitionBranch = input<number>();
  private readonly region = inject(TransitionRegion, { optional: true });
  private readonly element: Element = inject<ElementRef<Element>>(ElementRef).nativeElement;
  private entering = false;
  private stopEnter: (() => void) | undefined;

  constructor() {
    afterNextRender({
      write: () => {
        if (this.entering) this.stopEnter = this.run("enter");
      },
    });
    inject(DestroyRef).onDestroy(() => this.stopEnter?.());
  }

  ngOnInit(): void {
    this.entering = Boolean(this.region?.ready) || this.ufTransitionAppear();
  }

  /**
   * `(animate.leave)`: runs the leave when the region shows another branch than the element's,
   * and lets the element go at once when it still shows it: something around it removed it.
   */
  leave(event: AnimationCallbackEvent): void {
    this.stopEnter?.();
    if (!this.region || this.region.ufTransitionRegion() === this.ufTransitionBranch()) {
      event.animationComplete();
      return;
    }
    this.run("leave", () => event.animationComplete());
  }
  private run(phase: "enter" | "leave", done?: () => void): () => void {
    const { element } = this;
    const from = `${this.ufTransition()}-${phase}-from`;
    const active = `${this.ufTransition()}-${phase}-active`;
    const to = `${this.ufTransition()}-${phase}-to`;
    let frame = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const stop = () => {
      cancelAnimationFrame(frame);
      clearTimeout(timer);
      element.removeEventListener("transitionend", end);
      element.removeEventListener("animationend", end);
      element.classList.remove(from, active, to);
    };
    const end = (event?: Event) => {
      if (event && event.target !== element) return;
      stop();
      done?.();
    };
    element.classList.add(from, active);
    frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => {
        element.classList.remove(from);
        element.classList.add(to);
        const style = getComputedStyle(element);
        const longest = (delays: string, durations: string) => {
          const each = (list: string) =>
            list.split(", ").map((time) => Number(time.slice(0, -1)) * 1000);
          const delay = each(delays);
          return Math.max(
            0,
            ...each(durations).map(
              (duration, index) => duration + (delay[index % delay.length] ?? 0),
            ),
          );
        };
        const time = Math.max(
          longest(style.transitionDelay, style.transitionDuration),
          longest(style.animationDelay, style.animationDuration),
        );
        if (!time) {
          end();
          return;
        }
        element.addEventListener("transitionend", end);
        element.addEventListener("animationend", end);
        timer = setTimeout(end, time + 1);
      });
    });
    return stop;
  }
}

@Component({
  selector: "uf-steps",
  imports: [ScopeAttributes, Transition, TransitionRegion],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let first = this.first();
    @let step = this.step();
    <section
      class="steps"
      aria-label="Checkout"
      [class]="this.class()"
      [style]="this.style()"
      data-uf-84fe8ccf=""
      [ufScope]="this.host"
    >
      <button type="button" (click)="onSwap()" data-uf-84fe8ccf="">Swap</button>
      <ng-container [ufTransitionRegion]="(first) ? 0 : 1">
        @if (first) {
          <p
            [ufTransition]="'swap'"
            [ufTransitionBranch]="0"
            #transition="ufTransition"
            (animate.leave)="transition.leave($event)"
            class="card"
            data-uf-84fe8ccf=""
          >Cart</p>
        } @else {
          <p
            [ufTransition]="'swap'"
            [ufTransitionBranch]="1"
            #transition="ufTransition"
            (animate.leave)="transition.leave($event)"
            class="card"
            data-uf-84fe8ccf=""
          >Payment</p>
        }
      </ng-container>
      <button type="button" (click)="onNext()" data-uf-84fe8ccf="">Next</button>
      <ng-container [ufTransitionRegion]="(step === 1) ? 0 : (step === 2) ? 1 : 2">
        @if (step === 1) {
          <p
            [ufTransition]="'step'"
            [ufTransitionBranch]="0"
            #transition="ufTransition"
            (animate.leave)="transition.leave($event)"
            class="step"
            data-uf-84fe8ccf=""
          >Step one</p>
        } @else if (step === 2) {
          <p
            [ufTransition]="'step'"
            [ufTransitionBranch]="1"
            #transition="ufTransition"
            (animate.leave)="transition.leave($event)"
            class="step"
            data-uf-84fe8ccf=""
          >Step two</p>
        } @else {
          <p
            [ufTransition]="'step'"
            [ufTransitionBranch]="2"
            #transition="ufTransition"
            (animate.leave)="transition.leave($event)"
            class="step"
            data-uf-84fe8ccf=""
          >Step three</p>
        }
      </ng-container>
    </section>
  `,
  styleUrl: "./Steps.uf.tsx.css",
  encapsulation: ViewEncapsulation.None,
})
export default class Steps {
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  protected readonly first = signal(true);
  protected readonly step = signal(1);

  protected onSwap() {
    this.first.set(!this.first());
  }

  protected onNext() {
    this.step.set((this.step() % 3) + 1);
  }
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
