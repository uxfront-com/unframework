import {
  Component,
  ElementRef,
  Injector,
  type OnInit,
  afterRenderEffect,
  computed,
  inject,
  output,
  signal,
  untracked,
  viewChild,
} from "@angular/core";

@Component({
  selector: "uf-message-list",
  host: { style: "display: contents" },
  preserveWhitespaces: false,
  template: `
    @let messages = this.messages();
    <section class="message-list" aria-label="Messages">
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
}
