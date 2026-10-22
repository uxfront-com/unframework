import {
  Component,
  Directive,
  ElementRef,
  type OnInit,
  Renderer2,
  inject,
  input,
} from "@angular/core";

interface LogLine {
  id: string;
  text: string;
}

export interface BuildLogProps {
  target: string;
  failed: boolean;
  lines?: LogLine[] | null;
  warnings?: string[];
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
  selector: "uf-build-log",
  imports: [ScopeAttributes],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let target = this.target();
    @let failed = this.failed();
    @let lines = this.lines();
    @let warnings = this.warnings();
    <section
      class="build-log"
      aria-label="Build log"
      [class]="this.class()"
      [style]="this.style()"
      [ufScope]="this.host"
    >
      <pre>$ make {{ target }}@if (failed) {<strong> (failed)</strong>}{{ "\\n" }}@for (line of lines ?? []; track line.id) {<code>{{ line.text }}{{ "\\n" }}</code>}</pre>
      <ul aria-label="Warnings">
        @for (warning of warnings ?? []; track warning) {
          <li>{{ warning }}</li>
        }
      </ul>
    </section>
  `,
})
export default class BuildLog {
  readonly target = input.required<string>();
  readonly failed = input.required<boolean>();
  readonly lines = input<LogLine[] | null>();
  readonly warnings = input<string[]>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
