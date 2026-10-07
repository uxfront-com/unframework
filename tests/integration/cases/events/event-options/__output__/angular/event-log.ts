import {
  Component,
  DestroyRef,
  Directive,
  ElementRef,
  Renderer2,
  inject,
  output,
  signal,
} from "@angular/core";

@Directive({ selector: "[ufClickCapture]" })
export class ClickCapture {
  readonly ufClickCapture = output<PointerEvent>();

  constructor() {
    const element: HTMLElement = inject(ElementRef).nativeElement;
    const stop = inject(Renderer2).listen(
      element,
      "click",
      (event: PointerEvent) => this.ufClickCapture.emit(event),
      { capture: true },
    );
    inject(DestroyRef).onDestroy(stop);
  }
}

@Directive({ selector: "[ufClickOnce]" })
export class ClickOnce {
  readonly ufClickOnce = output<PointerEvent>();

  constructor() {
    const element: HTMLElement = inject(ElementRef).nativeElement;
    const stop = inject(Renderer2).listen(
      element,
      "click",
      (event: PointerEvent) => this.ufClickOnce.emit(event),
      { once: true },
    );
    inject(DestroyRef).onDestroy(stop);
  }
}

@Directive({ selector: "[ufWheelPassive]" })
export class WheelPassive {
  readonly ufWheelPassive = output<WheelEvent>();

  constructor() {
    const element: HTMLElement = inject(ElementRef).nativeElement;
    const stop = inject(Renderer2).listen(
      element,
      "wheel",
      (event: WheelEvent) => this.ufWheelPassive.emit(event),
      { passive: true },
    );
    inject(DestroyRef).onDestroy(stop);
  }
}

@Component({
  selector: "uf-event-log",
  imports: [ClickCapture, ClickOnce, WheelPassive],
  host: { style: "display: contents" },
  preserveWhitespaces: false,
  template: `
    @let log = this.log();
    @let volume = this.volume();
    <section class="event-log" aria-label="Event options">
      <div
        class="panel"
        role="presentation"
        (ufClickCapture)="record('panel capture')"
        (click)="record('panel bubble')"
      >
        <button type="button" (click)="record('button')">Inside</button>
        <button type="button" (click)="onStopHere($event)">Stop here</button>
      </div>
      <button type="button" (ufClickOnce)="record('once')">Only once</button>
      <div class="reward" role="presentation" (click)="record('outer')">
        <button type="button" (ufClickOnce)="onClaimTheReward($event)">Claim the reward</button>
      </div>
      <div class="volume" role="group" aria-label="Volume" (ufWheelPassive)="changeVolume($event)">
        <output>{{ volume }}</output>
      </div>
      <ol aria-label="Log">
        @for (entry of log; track index; let index = $index) {
          <li>{{ entry }}</li>
        }
      </ol>
    </section>
  `,
})
export default class EventLog {
  protected readonly log = signal<string[]>([]);
  protected readonly volume = signal(5);

  protected record(line: string) {
    this.log.set([...this.log(), line]);
  }

  protected changeVolume(event: WheelEvent) {
    if (event.deltaY < 0) {
      this.volume.update((volume) => volume + 1);
    } else {
      this.volume.update((volume) => volume - 1);
    }
  }

  protected onStopHere(event: PointerEvent) {
    event.stopPropagation();
    this.record("stopped");
  }

  protected onClaimTheReward(event: PointerEvent) {
    event.stopPropagation();
    this.record("claimed");
  }
}
