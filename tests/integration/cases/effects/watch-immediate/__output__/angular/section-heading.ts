import { isPlatformBrowser } from "@angular/common";
import {
  Component,
  Directive,
  ElementRef,
  Injector,
  type OnInit,
  PLATFORM_ID,
  Renderer2,
  afterNextRender,
  effect,
  inject,
  input,
  output,
  untracked,
} from "@angular/core";

export interface SectionHeadingProps {
  title: string;
}

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
  selector: "uf-section-heading",
  imports: [ScopeAttributes],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let title = this.title();
    <h2
      class="section-heading"
      [class]="this.class()"
      [style]="this.style()"
      [ufScope]="this.host"
    >{{ title }}</h2>
  `,
})
export default class SectionHeading implements OnInit {
  readonly title = input.required<string>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufChange = output<[title: string, previous?: string]>();
  readonly ready = output<void>();
  private readonly injector = inject(Injector);
  private readonly platformId = inject(PLATFORM_ID);

  constructor() {
    afterNextRender(() => {
      this.ready.emit();
    });
  }

  ngOnInit(): void {
    let lastTitle = this.title();
    let first = true;
    effect(
      () => {
        const value = this.title();
        const previous = first ? undefined : lastTitle;
        first = false;
        lastTitle = value;
        if (!isPlatformBrowser(this.platformId)) return;
        untracked(() => {
          this.ufChange.emit([value, previous]);
        });
      },
      { injector: this.injector },
    );
  }
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
