import { Component, input, output, signal } from "@angular/core";

export interface QuickActionsProps {
  actions: string[];
}

@Component({
  selector: "uf-quick-actions",
  host: { style: "display: contents" },
  preserveWhitespaces: false,
  template: `
    @let actions = this.actions();
    @let query = this.query();
    @let lastKey = this.lastKey();
    @let subscriptions = this.subscriptions();
    <section class="quick-actions" aria-label="Quick actions">
      <label>Search<input
        name="query"
        (input)="onQueryInput($event)"
        (keydown)="onQueryKeydown($event)"
      /></label>
      <p>Query: {{ query }}</p>
      <label>Note<input name="note" (keydown)="void track($event)" /></label>
      <label>Scope<select
        name="scope"
        (change)="onScopeChange($event)"
      ><option value="mine">Mine</option><option value="team">Team</option></select></label>
      <ul aria-label="Actions">
        @for (action of actions; track action) {
          <li>
            <label>{{ "Shortcut for " + action }}<input
              [attr.name]="action"
              (keydown)="void keyFor(action, $event)"
            /></label>
            <button
              type="button"
              (click)="choose(action, this.scope())"
            >{{ "Run " + action }}</button>
          </li>
        }
      </ul>
      <p>Last key: {{ lastKey }}</p>
      <form
        class="subscribe"
        aria-label="Subscribe"
        (submit)="once(submitOnce, $event) && onSubscribeSubmitOnce($event); onSubscribeSubmit($event)"
      >
        <p>Subscriptions: {{ subscriptions }}</p>
        <button type="submit">Subscribe</button>
      </form>
    </section>
  `,
})
export default class QuickActions {
  readonly actions = input.required<string[]>();
  readonly welcomed = output<void>();
  readonly subscribed = output<number>();
  readonly chosen = output<[action: string, scope: string]>();
  protected readonly query = signal("");
  protected readonly lastKey = signal("none");
  protected readonly scope = signal("mine");
  protected readonly subscriptions = signal(0);
  protected readonly submitOnce = new WeakSet<EventTarget>();

  private clear(event: KeyboardEvent) {
    event.preventDefault();
    this.query.set("");
  }

  protected track(event: KeyboardEvent): boolean {
    this.lastKey.set(event.key);
    return event.key === "Enter";
  }

  protected keyFor(action: string, event: KeyboardEvent): boolean {
    this.lastKey.set(`${action}: ${event.key}`);
    return false;
  }

  protected choose(action: string, current: string) {
    this.chosen.emit([action, current]);
  }

  protected onQueryInput(event: InputEvent) {
    this.query.set((event.currentTarget as HTMLInputElement).value);
  }

  protected onQueryKeydown(event: KeyboardEvent) {
    if (event.key === "Escape") this.clear(event);
  }

  protected onScopeChange(event: Event) {
    this.scope.set((event.currentTarget as HTMLSelectElement).value);
  }

  protected onSubscribeSubmitOnce(event: SubmitEvent) {
    event.preventDefault();
    this.welcomed.emit();
  }

  protected onSubscribeSubmit(event: SubmitEvent) {
    event.preventDefault();
    this.subscriptions.update((subscriptions) => subscriptions + 1);
    this.subscribed.emit(this.subscriptions());
  }

  protected once(elements: WeakSet<EventTarget>, event: Event): boolean {
    const element = event.currentTarget;
    if (element === null || elements.has(element)) return false;
    elements.add(element);
    return true;
  }
}
