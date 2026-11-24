import { Fallthrough } from "./_unframework/Fallthrough";
import type { Listeners } from "./_unframework/Listeners";
import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import {
  Component,
  ElementRef,
  type OnInit,
  inject,
  input,
  linkedSignal,
  output,
  signal,
  untracked,
  viewChild,
} from "@angular/core";

export interface Contact {
  id: string;
  name: string;
}

export interface ContactListProps {
  initial: Contact[];
}

@Component({
  selector: "uf-contact-list",
  imports: [ScopeAttributes, Fallthrough],
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
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      [ufScope]="this.host"
      #ufElement
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
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  readonly choose = output<[id: string, position: number]>();
  readonly removed = output<string>();
  readonly ufElement = viewChild<ElementRef<HTMLElement>>("ufElement");
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
