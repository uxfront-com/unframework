import { Fallthrough } from "./_unframework/Fallthrough";
import type { Listeners } from "./_unframework/Listeners";
import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import {
  Component,
  ElementRef,
  Injector,
  type OnInit,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
  viewChild,
} from "@angular/core";

@Component({
  selector: "uf-zoom-control",
  imports: [ScopeAttributes, Fallthrough],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let zoom = this.zoom();
    @let history = this.history();
    <section
      class="zoom-control"
      aria-label="Zoom"
      [class]="this.class()"
      [style]="this.style()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      [ufScope]="this.host"
      #ufElement
    >
      <output>{{ zoom }}%</output>
      <button type="button" (click)="onZoomIn()">Zoom in</button>
      <button type="button" (click)="onZoomOut()">Zoom out</button>
      <button type="button" (click)="onReset()">Reset</button>
      <ol aria-label="History">
        @for (entry of history; track index; let index = $index) {
          <li>{{ entry }}</li>
        }
      </ol>
    </section>
  `,
})
export default class ZoomControl implements OnInit {
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  readonly ufElement = viewChild<ElementRef<HTMLElement>>("ufElement");
  private readonly injector = inject(Injector);
  protected readonly zoom = signal(100);
  protected readonly history = signal<string[]>([]);

  ngOnInit(): void {
    const currentZoom = computed(() => this.zoom());
    let lastZoom = currentZoom();
    effect(
      () => {
        const value = currentZoom();
        if (Object.is(value, lastZoom)) return;
        const previous = lastZoom;
        lastZoom = value;
        untracked(() => {
          this.history.set([...this.history(), `${previous}% to ${value}%`]);
        });
      },
      { injector: this.injector },
    );
  }

  protected onZoomIn() {
    this.zoom.update((zoom) => zoom + 25);
  }

  protected onZoomOut() {
    this.zoom.update((zoom) => zoom - 25);
  }

  protected onReset() {
    this.zoom.set(100);
  }
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
