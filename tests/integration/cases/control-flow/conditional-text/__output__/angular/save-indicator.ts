import {
  Component,
  Directive,
  ElementRef,
  type OnInit,
  Renderer2,
  inject,
  input,
} from "@angular/core";

export interface SaveIndicatorProps {
  saving: boolean;
  changes: number;
  savedAt?: string;
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
  selector: "uf-save-indicator",
  imports: [ScopeAttributes],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let saving = this.saving();
    @let changes = this.changes();
    @let savedAt = this.savedAt();
    <p
      class="save-indicator"
      role="status"
      [class]="this.class()"
      [style]="this.style()"
      [ufScope]="this.host"
    >
      @if (saving) {<em>Saving</em>} @else {Saved}, {{ changes === 1 ? "1 change" : changes + " changes" }}@if (savedAt) {<time
        [attr.datetime]="savedAt"
      >{{ " at " + savedAt }}</time>} @else { just now}
    </p>
  `,
})
export default class SaveIndicator {
  readonly saving = input.required<boolean>();
  readonly changes = input.required<number>();
  readonly savedAt = input<string>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
