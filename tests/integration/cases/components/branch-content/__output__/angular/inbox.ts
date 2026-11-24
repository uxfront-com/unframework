import { Fallthrough } from "./_unframework/Fallthrough";
import type { Listeners } from "./_unframework/Listeners";
import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import Notice from "./notice";
import {
  Component,
  ElementRef,
  type OnInit,
  inject,
  input,
  linkedSignal,
  untracked,
  viewChild,
} from "@angular/core";

@Component({
  selector: "uf-inbox",
  imports: [Notice, ScopeAttributes, Fallthrough],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let count = this.count();
    <div
      class="inbox"
      [class]="this.class()"
      [style]="this.style()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      [ufScope]="this.host"
      #ufElement
    >
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
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  readonly ufElement = viewChild<ElementRef<HTMLDivElement>>("ufElement");
  protected readonly count = linkedSignal(() => untracked(() => this.unread()));

  ngOnInit(): void {
    // Read once the inputs are set: these keep the values they start with.
    this.count();
  }

  protected onMarkAllRead() {
    this.count.set(0);
  }
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
