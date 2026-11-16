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

/** Whether its component has rendered once: a transition's element created later enters. */
class TransitionGate {
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
  readonly ufTransitionGate = input.required<TransitionGate>();
  readonly ufTransitionAppear = input(false);
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
    this.entering = this.ufTransitionGate().ready || this.ufTransitionAppear();
  }

  /**
   * `(animate.leave)`: runs the leave when the element's own branch is no longer shown, and lets
   * the element go at once when it still is: something around it removed it.
   */
  leave(event: AnimationCallbackEvent, shown: boolean): void {
    this.stopEnter?.();
    if (shown) {
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
      [ufTransitionGate]="this.transitions"
      [ufTransitionAppear]="true"
      class="toast"
      role="status"
      data-uf-acfe4ebf=""
    >Saved</p>
  `,
  styleUrl: "./Toast.uf.tsx.css",
  encapsulation: ViewEncapsulation.None,
})
export default class Toast {
  protected readonly transitions = new TransitionGate();
}
