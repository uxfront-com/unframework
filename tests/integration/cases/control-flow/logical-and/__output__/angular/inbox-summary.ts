import {
  Component,
  Directive,
  ElementRef,
  type OnInit,
  Renderer2,
  inject,
  input,
} from "@angular/core";

export interface InboxSummaryProps {
  folder: string;
  unread: number;
  flagged: number;
  signature: string;
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
  selector: "uf-inbox-summary",
  imports: [ScopeAttributes],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let folder = this.folder();
    @let unread = this.unread();
    @let flagged = this.flagged();
    @let signature = this.signature();
    <section
      class="inbox-summary"
      aria-label="Inbox summary"
      [class]="this.class()"
      [style]="this.style()"
      [ufScope]="this.host"
    >
      <h2>{{ folder || "Inbox" }}</h2>
      @if (unread) {
        <p>{{ unread }} unread</p>
      }
      @if (flagged) {
        <p>{{ flagged }} flagged</p>
      }
      @if (unread > 0 && flagged > 0) {
        <p>Some unread messages are flagged.</p>
      }
      @if (folder) {
        <p>Filed under {{ folder }}</p>
      }
      @if (signature) {
        <p class="inbox-signature">{{ signature }}</p>
      }
    </section>
  `,
})
export default class InboxSummary {
  readonly folder = input.required<string>();
  readonly unread = input.required<number>();
  readonly flagged = input.required<number>();
  readonly signature = input.required<string>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
