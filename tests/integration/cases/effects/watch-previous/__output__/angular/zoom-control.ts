import {
  Component,
  Directive,
  ElementRef,
  Injector,
  type OnInit,
  Renderer2,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
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
  selector: "uf-zoom-control",
  imports: [ScopeAttributes],
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
      [ufScope]="this.host"
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
