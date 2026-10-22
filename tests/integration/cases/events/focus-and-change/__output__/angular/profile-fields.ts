import {
  Component,
  Directive,
  ElementRef,
  type OnInit,
  Renderer2,
  inject,
  input,
  output,
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
  selector: "uf-profile-fields",
  imports: [ScopeAttributes],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let log = this.log();
    @let nickname = this.nickname();
    @let cardFocuses = this.cardFocuses();
    @let cardBlurs = this.cardBlurs();
    <section
      class="profile-fields"
      aria-label="Profile"
      [class]="this.class()"
      [style]="this.style()"
      [ufScope]="this.host"
    >
      <div
        class="name-group"
        role="group"
        aria-label="Name fields"
        (focusin)="record('group focusin')"
        (focusout)="record('group focusout')"
      >
        <label>Name<input name="name" (focus)="record('name focus')" (blur)="record('name blur')" /></label>
      </div>
      <label>Nickname<input
        name="nickname"
        (change)="onNicknameChange($event); void (once(changeOnce, $event) && onNicknameChangeOnce($event))"
      /></label>
      <p>Nickname: {{ nickname }}</p>
      <label><input
        type="checkbox"
        name="public"
        (click)="record('public click')"
        (input)="record('public input')"
        (change)="record('public change')"
      />Public profile</label>
      <label><input
        type="checkbox"
        name="locked"
        (click)="hold($event)"
        (change)="record('locked change')"
      />Locked</label>
      <div
        class="card"
        role="group"
        aria-label="Card"
        tabindex="-1"
        (focus)="onCardFocus()"
        (blur)="onCardBlur()"
      >
        <p>{{ cardFocuses > cardBlurs ? "Card focused" : "Card not focused" }}</p>
        <p>Card blurs: {{ cardBlurs }}</p>
        <button type="button" (click)="record('card button')">Inside the card</button>
      </div>
      <ol aria-label="Log">
        @for (entry of log; track index; let index = $index) {
          <li>{{ entry }}</li>
        }
      </ol>
    </section>
  `,
})
export default class ProfileFields {
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly firstNickname = output<string>();
  protected readonly log = signal<string[]>([]);
  protected readonly nickname = signal("");
  protected readonly cardFocuses = signal(0);
  protected readonly cardBlurs = signal(0);
  protected readonly changeOnce = new WeakSet<EventTarget>();

  protected record(line: string) {
    this.log.set([...this.log(), line]);
  }

  protected hold(event: MouseEvent) {
    event.preventDefault();
    this.record("locked click");
  }

  protected onNicknameChange(event: Event) {
    this.nickname.set((event.currentTarget as HTMLInputElement).value);
  }

  protected onNicknameChangeOnce(event: Event) {
    this.firstNickname.emit((event.currentTarget as HTMLInputElement).value);
  }

  protected onCardFocus() {
    this.cardFocuses.update((cardFocuses) => cardFocuses + 1);
  }

  protected onCardBlur() {
    this.cardBlurs.update((cardBlurs) => cardBlurs + 1);
  }

  protected once(elements: WeakSet<EventTarget>, event: Event): boolean {
    const element = event.currentTarget;
    if (element === null || elements.has(element)) return false;
    elements.add(element);
    return true;
  }
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
