import {
  Component,
  Directive,
  ElementRef,
  Injector,
  type OnInit,
  Renderer2,
  afterRenderEffect,
  computed,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChild,
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
  selector: "uf-message-list",
  imports: [ScopeAttributes],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let messages = this.messages();
    <section
      class="message-list"
      aria-label="Messages"
      [class]="this.class()"
      [style]="this.style()"
      [ufScope]="this.host"
    >
      <ul #list>
        @for (message of messages; track message) {
          <li>{{ message }}</li>
        }
      </ul>
      <button type="button" (click)="add()">Add a message</button>
    </section>
  `,
})
export default class MessageList implements OnInit {
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly rendered = output<number>();
  private readonly list = viewChild<ElementRef<HTMLUListElement>>("list");
  private readonly injector = inject(Injector);
  protected readonly messages = signal(["Welcome to the team"]);

  ngOnInit(): void {
    const currentMessages = computed(() => this.messages());
    let lastMessages = currentMessages();
    afterRenderEffect(
      () => {
        const value = currentMessages();
        if (Object.is(value, lastMessages)) return;
        lastMessages = value;
        untracked(() => {
          this.rendered.emit(this.list()?.nativeElement.childElementCount ?? 0);
        });
      },
      { injector: this.injector },
    );
  }

  protected add() {
    this.messages.set([...this.messages(), `Message ${this.messages().length + 1}`]);
  }
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
