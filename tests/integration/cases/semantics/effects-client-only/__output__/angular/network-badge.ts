import {
  Component,
  Injector,
  type OnInit,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from "@angular/core";

@Component({
  selector: "uf-network-badge",
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let online = this.online();
    @let label = this.label();
    <p
      class="network-badge"
      role="status"
      [attr.data-checked]="online === undefined ? 'no' : 'yes'"
      [class]="this.class()"
      [style]="this.style()"
    >{{ label }}</p>
  `,
})
export default class NetworkBadge implements OnInit {
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  private readonly injector = inject(Injector);
  protected readonly online = signal<boolean | undefined>(undefined);
  protected readonly label = signal("Checking the connection");

  constructor() {
    afterNextRender(() => {
      this.online.set(navigator.onLine);
    });
  }

  ngOnInit(): void {
    const currentOnline = computed(() => this.online());
    let lastOnline = currentOnline();
    effect(
      () => {
        const value = currentOnline();
        if (Object.is(value, lastOnline)) return;
        lastOnline = value;
        untracked(() => {
          this.label.set(value ? "Online" : "Offline");
        });
      },
      { injector: this.injector },
    );
  }
}
