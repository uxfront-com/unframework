import { isPlatformBrowser } from "@angular/common";
import {
  Component,
  Directive,
  ElementRef,
  type OnChanges,
  type OnDestroy,
  type OnInit,
  PLATFORM_ID,
  Renderer2,
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

/** A native listener of each event a consumer passes, by the event's name (ADR-0118). */
type Listeners = { [K in keyof HTMLElementEventMap]?: (event: HTMLElementEventMap[K]) => void };

/**
 * Puts what a consumer passes the component, and the component does not declare, on the element
 * that takes it (ADR-0118): the attributes, the consumer's winning over the element's own, and
 * the native listeners, which run after the element's own.
 */
@Directive({ selector: "[ufFallthrough]" })
export class Fallthrough implements OnChanges, OnDestroy {
  readonly ufFallthrough = input.required<{
    attributes: Record<string, unknown> | undefined;
    listeners: Listeners | undefined;
  }>();
  private readonly element = inject<ElementRef<Element>>(ElementRef);
  private readonly renderer = inject(Renderer2);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly listening = new Map<string, { handler: unknown; stop: () => void }>();
  private written: Record<string, unknown> = {};

  ngOnChanges(): void {
    const element = this.element.nativeElement;
    const { attributes = {}, listeners = {} } = this.ufFallthrough();
    for (const name of Object.keys(this.written)) {
      if (!(name in attributes)) this.renderer.removeAttribute(element, name);
    }
    for (const [name, value] of Object.entries(attributes)) {
      if (value === null || value === undefined) this.renderer.removeAttribute(element, name);
      else this.renderer.setAttribute(element, name, String(value));
    }
    this.written = attributes;
    if (!this.browser) return;
    const handlers = new Map(Object.entries(listeners));
    for (const [event, { handler, stop }] of this.listening) {
      if (handlers.get(event) === handler) continue;
      stop();
      this.listening.delete(event);
    }
    for (const [event, handler] of handlers) {
      if (handler === undefined || this.listening.has(event)) continue;
      this.listening.set(event, { handler, stop: this.renderer.listen(element, event, handler) });
    }
  }

  ngOnDestroy(): void {
    for (const { stop } of this.listening.values()) stop();
  }
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
