import { isPlatformBrowser } from "@angular/common";
import {
  Component,
  Directive,
  ElementRef,
  type OnDestroy,
  type OnInit,
  PLATFORM_ID,
  Renderer2,
  afterNextRender,
  inject,
  input,
  output,
  signal,
  viewChild,
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
  selector: "uf-profile-menu",
  imports: [ScopeAttributes],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let open = this.open();
    <section
      class="profile-menu"
      aria-label="Profile"
      [class]="this.class()"
      [style]="this.style()"
      [ufScope]="this.host"
    >
      <div class="menu" #menu>
        <button type="button" [attr.aria-expanded]="open" (click)="onAccount()">Account</button>
        @if (open) {
          <ul aria-label="Account actions">
            <li>
              <button type="button">Settings</button>
            </li>
            <li>
              <button type="button">Sign out</button>
            </li>
          </ul>
        }
      </div>
      <p>Outside the menu</p>
    </section>
  `,
})
export default class ProfileMenu implements OnDestroy {
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly closed = output<void>();
  private readonly menu = viewChild<ElementRef<HTMLDivElement>>("menu");
  private readonly platformId = inject(PLATFORM_ID);
  private readonly onDocumentClick = (event: MouseEvent) => {
    const element = this.menu()?.nativeElement ?? null;
    if (this.open() && element && !element.contains(event.target as Node)) {
      this.open.set(false);
      this.closed.emit();
    }
  };
  protected readonly open = signal(false);

  constructor() {
    afterNextRender(() => {
      document.addEventListener("click", this.onDocumentClick);
    });
  }

  ngOnDestroy(): void {
    if (isPlatformBrowser(this.platformId)) {
      document.removeEventListener("click", this.onDocumentClick);
    }
  }

  protected onAccount() {
    this.open.set(!this.open());
  }
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
