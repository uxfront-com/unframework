import { Component, output, signal } from "@angular/core";

@Component({
  selector: "uf-profile-fields",
  host: { style: "display: contents" },
  preserveWhitespaces: false,
  template: `
    @let log = this.log();
    @let nickname = this.nickname();
    @let cardFocuses = this.cardFocuses();
    @let cardBlurs = this.cardBlurs();
    <section class="profile-fields" aria-label="Profile">
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
}
