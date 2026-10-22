import { isPlatformBrowser } from "@angular/common";
import {
  Component,
  Directive,
  ElementRef,
  type OnDestroy,
  type OnInit,
  PLATFORM_ID,
  Renderer2,
  afterNextRender,
  inject,
  input,
  output,
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

@Component({
  selector: "uf-draft-editor",
  imports: [ScopeAttributes],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let saves = this.saves();
    <section
      class="draft-editor"
      aria-label="Draft"
      [class]="this.class()"
      [style]="this.style()"
      [ufScope]="this.host"
    >
      <label>Draft<textarea name="draft"></textarea></label>
      <p role="status">Saved: {{ saves }}</p>
    </section>
  `,
})
export default class DraftEditor implements OnDestroy {
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly saved = output<number>();
  private readonly platformId = inject(PLATFORM_ID);
  private readonly onShortcut = (event: KeyboardEvent) => {
    if (event.key !== "s" || !event.ctrlKey) return;
    event.preventDefault();
    this.saves.update((saves) => saves + 1);
    this.saved.emit(this.saves());
  };
  protected readonly saves = signal(0);

  constructor() {
    afterNextRender(() => {
      document.addEventListener("keydown", this.onShortcut);
    });
  }

  ngOnDestroy(): void {
    if (isPlatformBrowser(this.platformId)) {
      document.removeEventListener("keydown", this.onShortcut);
    }
  }
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
