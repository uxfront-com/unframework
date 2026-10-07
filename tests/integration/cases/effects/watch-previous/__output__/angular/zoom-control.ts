import {
  Component,
  Injector,
  type OnInit,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from "@angular/core";

@Component({
  selector: "uf-zoom-control",
  host: { style: "display: contents" },
  preserveWhitespaces: false,
  template: `
    @let zoom = this.zoom();
    @let history = this.history();
    <section class="zoom-control" aria-label="Zoom">
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
}
