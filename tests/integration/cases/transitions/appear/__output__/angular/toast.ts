import {
  type AnimationCallbackEvent,
  Component,
  DestroyRef,
  Directive,
  ElementRef,
  type OnInit,
  ViewEncapsulation,
  afterNextRender,
  inject,
  input,
} from "@angular/core";

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
  selector: "uf-toast",
  imports: [Transition],
  host: { style: "display: contents" },
  preserveWhitespaces: false,
  template: `
    <p
      [ufTransition]="'pop'"
      [ufTransitionAppear]="true"
      class="toast"
      role="status"
      data-uf-acfe4ebf=""
    >Saved</p>
  `,
  styleUrl: "./Toast.uf.tsx.css",
  encapsulation: ViewEncapsulation.None,
})
export default class Toast {}
