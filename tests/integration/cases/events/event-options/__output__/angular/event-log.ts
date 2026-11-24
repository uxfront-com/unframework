import { ClickCapture } from "./_unframework/ClickCapture";
import { ClickOnce } from "./_unframework/ClickOnce";
import { Fallthrough } from "./_unframework/Fallthrough";
import type { Listeners } from "./_unframework/Listeners";
import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import { WheelPassive } from "./_unframework/WheelPassive";
import { Component, ElementRef, inject, input, signal, viewChild } from "@angular/core";

@Component({
  selector: "uf-event-log",
  imports: [ClickCapture, ClickOnce, WheelPassive, ScopeAttributes, Fallthrough],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let log = this.log();
    @let volume = this.volume();
    <section
      class="event-log"
      aria-label="Event options"
      [class]="this.class()"
      [style]="this.style()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      [ufScope]="this.host"
      #ufElement
    >
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
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  readonly ufElement = viewChild<ElementRef<HTMLElement>>("ufElement");
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
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
