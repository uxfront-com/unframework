import {
  Component,
  Directive,
  ElementRef,
  type OnInit,
  Renderer2,
  inject,
  input,
  signal,
} from "@angular/core";

type TagStates = { selected?: boolean; muted?: boolean };

export interface TagListProps {
  label: string;
  tags: string[];
  states: TagStates;
  extra?: string[];
}

/**
 * Class names as Vue's `normalizeClass` reads them (ADR-0065): a string as it is, an array's
 * entries and an object's keys whose values are truthy, Angular's `[class]` taking the string.
 */
function classNames(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(classNames).filter(Boolean).join(" ");
  if (!value || typeof value !== "object") return "";
  return Object.entries(value)
    .flatMap(([key, on]) => (on ? [key] : []))
    .join(" ");
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
  selector: "uf-tag-list",
  imports: [ScopeAttributes],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let label = this.label();
    @let tags = this.tags();
    @let states = this.states();
    @let extra = this.extra();
    @let expanded = this.expanded();
    <div class="tag-list" [class]="this.class()" [style]="this.style()" [ufScope]="this.host">
      <span
        class="tag"
        [class]="classNames([tags, states, { 'tag-open': expanded }])"
      >{{ label }}</span>
      <span [class]="classNames(tags)">Plain</span>
      <span [class]="classNames([extra, expanded ? ['tag-wide', 'tag-tall'] : []])">Extra</span>
      <button type="button" (click)="expand()">Expand</button>
    </div>
  `,
})
export default class TagList {
  readonly label = input.required<string>();
  readonly tags = input.required<string[]>();
  readonly states = input.required<TagStates>();
  readonly extra = input<string[]>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  protected readonly expanded = signal(false);
  protected readonly classNames = classNames;

  protected expand() {
    this.expanded.set(!this.expanded());
  }
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
