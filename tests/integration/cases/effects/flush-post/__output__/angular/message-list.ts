import { Fallthrough } from "./_unframework/Fallthrough";
import type { Listeners } from "./_unframework/Listeners";
import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import {
  Component,
  ElementRef,
  Injector,
  type OnInit,
  afterRenderEffect,
  computed,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from "@angular/core";

@Component({
  selector: "uf-message-list",
  imports: [ScopeAttributes, Fallthrough],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let messages = this.messages();
    <section
      class="message-list"
      aria-label="Messages"
      [class]="this.class()"
      [style]="this.style()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      [ufScope]="this.host"
      #ufElement
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
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  readonly rendered = output<number>();
  private readonly list = viewChild<ElementRef<HTMLUListElement>>("list");
  readonly ufElement = viewChild<ElementRef<HTMLElement>>("ufElement");
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
