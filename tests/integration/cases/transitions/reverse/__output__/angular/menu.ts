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
  selector: "uf-menu",
  imports: [ScopeAttributes, Transition, TransitionRegion],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let open = this.open();
    <nav
      class="menu"
      aria-label="Account"
      [class]="this.class()"
      [style]="this.style()"
      data-uf-e688a71a=""
      [ufScope]="this.host"
    >
      <button
        type="button"
        [attr.aria-expanded]="open"
        (click)="refresh()"
        data-uf-e688a71a=""
      >Refresh</button>
      <ng-container [ufTransitionRegion]="(open) ? 0 : -1">
        @if (open) {
          <ul
            [ufTransition]="'fade'"
            [ufTransitionBranch]="0"
            #transition="ufTransition"
            (animate.leave)="transition.leave($event)"
            class="items"
            data-uf-e688a71a=""
          >
            <li data-uf-e688a71a="">Profile</li>
          </ul>
        }
      </ng-container>
    </nav>
  `,
  styleUrl: "./Menu.uf.tsx.css",
  encapsulation: ViewEncapsulation.None,
})
export default class Menu {
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  protected readonly open = signal(true);

  protected refresh() {
    this.open.set(false);
    setTimeout(() => {
      this.open.set(true);
    }, 80);
  }
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
