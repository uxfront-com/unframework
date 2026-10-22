import {
  Component,
  Directive,
  ElementRef,
  type OnInit,
  Renderer2,
  inject,
  input,
} from "@angular/core";

export interface DraftNoticeProps {
  author: string;
  saved: boolean;
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
  selector: "uf-draft-notice",
  imports: [ScopeAttributes],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let author = this.author();
    @let saved = this.saved();
    <section
      class="draft-notice"
      aria-label="Draft"
      [class]="this.class()"
      [style]="this.style()"
      [ufScope]="this.host"
    >
      <img
        src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32'%3E%3Crect width='32' height='32' fill='%23345'/%3E%3C/svg%3E"
        [attr.alt]="author + &quot;'s avatar&quot;"
        width="32"
        height="32"
      />
      <p
        [attr.title]="saved ? 'Saved' : &quot;Don't forget to save&quot;"
      >{{ saved ? "Saved" : 'Not "saved" yet' }}</p>
      <p
        [attr.title]="saved ? 'Nothing to save' : 'Press &quot;Save&quot; to keep ' + author + &quot;'s changes&quot;"
      >{{ saved ? author + "'s draft is safe." : author + " says: \\u0022I'll save it later.\\u0022" }}</p>
    </section>
  `,
})
export default class DraftNotice {
  readonly author = input.required<string>();
  readonly saved = input.required<boolean>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
