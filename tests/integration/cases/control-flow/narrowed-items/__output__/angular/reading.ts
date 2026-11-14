import {
  Component,
  Directive,
  ElementRef,
  type OnInit,
  Renderer2,
  inject,
  input,
  output,
} from "@angular/core";

export type Source =
  | { kind: "link"; id: string; title: string; href: string }
  | { kind: "book"; id: string; title: string; note?: string };

export interface ReadingProps {
  sources: Source[];
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
  selector: "uf-reading",
  imports: [ScopeAttributes],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let sources = this.sources();
    <ul
      class="reading"
      aria-label="Reading list"
      [class]="this.class()"
      [style]="this.style()"
      [ufScope]="this.host"
    >
      @for (source of sources; track source.id; let index = $index) {
        <li
          [attr.title]="source.kind === 'link' ? source.href : source.title"
        >{{ index + 1 }}. {{ source.title }}{{ source.kind === "book" && source.note ? " (" + source.note.trim() + ")" : "" }}@if (source.kind === "link") {<button
          type="button"
          (click)="open.emit(source.href)"
        >{{ "Open " + source.title }}</button>}</li>
      }
    </ul>
  `,
})
export default class Reading {
  readonly sources = input.required<Source[]>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly open = output<string>();
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
