import {
  Component,
  Directive,
  ElementRef,
  type OnInit,
  Renderer2,
  inject,
  input,
} from "@angular/core";

export interface InboxMessage {
  id: string;
  subject: string;
}

export interface MessageListProps {
  messages: InboxMessage[];
  archived?: InboxMessage[];
  emptyText?: string;
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
  selector: "uf-message-list",
  imports: [ScopeAttributes],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let messages = this.messages();
    @let archived = this.archived();
    @let emptyText = this.emptyText();
    <section
      class="message-list"
      aria-label="Messages"
      [class]="this.class()"
      [style]="this.style()"
      [ufScope]="this.host"
    >
      <h2>Inbox</h2>
      <ul>
        @for (message of messages; track message.id) {
          <li>{{ message.subject }}</li>
        }
      </ul>
      @if (messages.length === 0) {
        <p>{{ emptyText }}</p>
      }
      <h2>Archive</h2>
      <ul>
        @for (message of archived; track message.id) {
          <li>{{ message.subject }}</li>
        }
      </ul>
      @if (archived.length === 0) {
        <p>No archived messages.</p>
      } @else {
        <p>{{ archived.length }} archived</p>
      }
    </section>
  `,
})
export default class MessageList {
  readonly messages = input.required<InboxMessage[]>();
  readonly archived = input<InboxMessage[], InboxMessage[] | undefined>([], {
    transform: (value) => (value === undefined ? [] : value),
  });
  readonly emptyText = input<string, string | undefined>("Nothing here yet.", {
    transform: (value) => (value === undefined ? "Nothing here yet." : value),
  });
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
