import {
  Component,
  Directive,
  ElementRef,
  type OnInit,
  Renderer2,
  inject,
  input,
  linkedSignal,
  output,
  signal,
  untracked,
} from "@angular/core";

export interface Contact {
  id: string;
  name: string;
}

export interface ContactListProps {
  initial: Contact[];
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
  selector: "uf-contact-list",
  imports: [ScopeAttributes],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let contacts = this.contacts();
    @let chosen = this.chosen();
    <section
      class="contact-list"
      aria-label="Contacts"
      [class]="this.class()"
      [style]="this.style()"
      [ufScope]="this.host"
    >
      <ul>
        @for (contact of contacts; track contact.id; let index = $index) {
          <li>
            <button
              type="button"
              [attr.aria-pressed]="chosen === contact.id"
              (click)="pick(contact, index)"
            >{{ contact.name }}</button>
            <button
              type="button"
              [attr.aria-label]="'Remove ' + contact.name"
              (click)="drop(contact)"
            >Remove</button>
          </li>
        }
      </ul>
      <p role="status">Chosen: {{ chosen ?? "nobody" }}</p>
    </section>
  `,
})
export default class ContactList implements OnInit {
  readonly initial = input.required<Contact[]>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly choose = output<[id: string, position: number]>();
  readonly removed = output<string>();
  protected readonly contacts = linkedSignal(() => untracked(() => this.initial()));
  protected readonly chosen = signal<string | undefined>(undefined);

  ngOnInit(): void {
    // Read once the inputs are set: these keep the values they start with.
    this.contacts();
  }

  protected pick(entry: Contact, position: number) {
    this.chosen.set(entry.id);
    this.choose.emit([entry.id, position]);
  }

  protected drop(entry: Contact) {
    this.contacts.set(this.contacts().filter((other) => other.id !== entry.id));
    this.removed.emit(entry.name);
  }
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
