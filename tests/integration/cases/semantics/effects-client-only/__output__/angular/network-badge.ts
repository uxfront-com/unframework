import {
  Component,
  Directive,
  ElementRef,
  Injector,
  type OnInit,
  Renderer2,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
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
  selector: "uf-network-badge",
  imports: [ScopeAttributes],
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
      [ufScope]="this.host"
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
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
