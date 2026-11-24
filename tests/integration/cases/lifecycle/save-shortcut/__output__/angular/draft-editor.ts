import { Fallthrough } from "./_unframework/Fallthrough";
import type { Listeners } from "./_unframework/Listeners";
import { ScopeAttributes } from "./_unframework/ScopeAttributes";
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
  selector: "uf-draft-editor",
  imports: [ScopeAttributes, Fallthrough],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let saves = this.saves();
    <section
      class="draft-editor"
      aria-label="Draft"
      [class]="this.class()"
      [style]="this.style()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      [ufScope]="this.host"
      #ufElement
    >
      <label>Draft<textarea name="draft"></textarea></label>
      <p role="status">Saved: {{ saves }}</p>
    </section>
  `,
})
export default class DraftEditor implements OnDestroy {
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  readonly saved = output<number>();
  readonly ufElement = viewChild<ElementRef<HTMLElement>>("ufElement");
  private readonly platformId = inject(PLATFORM_ID);
  private readonly onShortcut = (event: KeyboardEvent) => {
    if (event.key !== "s" || !event.ctrlKey) return;
    event.preventDefault();
    this.saves.update((saves) => saves + 1);
    this.saved.emit(this.saves());
  };
  protected readonly saves = signal(0);

  constructor() {
    afterNextRender(() => {
      document.addEventListener("keydown", this.onShortcut);
    });
  }

  ngOnDestroy(): void {
    if (isPlatformBrowser(this.platformId)) {
      document.removeEventListener("keydown", this.onShortcut);
    }
  }
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
