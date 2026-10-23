import Tag from "./tag";
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
  selector: "uf-tags",
  imports: [Tag, ScopeAttributes],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let active = this.active();
    <div class="tags" [class]="this.class()" [style]="this.style()" [ufScope]="this.host">
      <uf-tag [label]="'plain'" />
      <uf-tag [label]="'wide'" [class]="'wide'" [style]="{ 'margin-left': '8px' }" />
      <uf-tag
        [label]="'toggled'"
        [class]="['picked', active ? 'active' : null].join(' ')"
        [style]="{ color: active ? 'rgb(200, 0, 0)' : undefined }"
      />
      <button type="button" (click)="onToggle()">Toggle</button>
    </div>
  `,
})
export default class Tags {
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  protected readonly active = signal(false);

  protected onToggle() {
    this.active.set(!this.active());
  }
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
