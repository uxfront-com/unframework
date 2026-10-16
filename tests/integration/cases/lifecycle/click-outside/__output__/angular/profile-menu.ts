import { isPlatformBrowser } from "@angular/common";
import {
  Component,
  ElementRef,
  type OnDestroy,
  PLATFORM_ID,
  afterNextRender,
  inject,
  input,
  output,
  signal,
  viewChild,
} from "@angular/core";

@Component({
  selector: "uf-profile-menu",
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let open = this.open();
    <section
      class="profile-menu"
      aria-label="Profile"
      [class]="this.class()"
      [style]="this.style()"
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
}
