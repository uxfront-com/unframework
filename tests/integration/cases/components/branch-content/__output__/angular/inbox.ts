import Notice from "./notice";
import { Component, type OnInit, input, linkedSignal, untracked } from "@angular/core";

@Component({
  selector: "uf-inbox",
  imports: [Notice],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let count = this.count();
    <div class="inbox" [class]="this.class()" [style]="this.style()">
      @if (count > 0) {
        <uf-notice [text]="count + ' unread'" [tone]="'info'" />
      } @else {
        <uf-notice [text]="'All read'" [tone]="'quiet'" />
      }
      <button type="button" (click)="onMarkAllRead()">Mark all read</button>
    </div>
  `,
})
export default class Inbox implements OnInit {
  readonly unread = input.required<number>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  protected readonly count = linkedSignal(() => untracked(() => this.unread()));

  ngOnInit(): void {
    // Read once the inputs are set: these keep the values they start with.
    this.count();
  }

  protected onMarkAllRead() {
    this.count.set(0);
  }
}
