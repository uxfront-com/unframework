import {
  Component,
  Injector,
  type OnInit,
  afterNextRender,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from "@angular/core";

@Component({
  selector: "uf-network-badge",
  host: { style: "display: contents" },
  preserveWhitespaces: false,
  template: `
    @let online = this.online();
    @let label = this.label();
    <p
      class="network-badge"
      role="status"
      [attr.data-checked]="online === undefined ? 'no' : 'yes'"
    >{{ label }}</p>
  `,
})
export default class NetworkBadge implements OnInit {
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
