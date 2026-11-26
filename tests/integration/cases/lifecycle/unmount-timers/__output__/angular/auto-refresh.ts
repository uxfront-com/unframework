import { Fallthrough } from "./_unframework/Fallthrough";
import type { Listeners } from "./_unframework/Listeners";
import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import { isPlatformBrowser } from "@angular/common";
import {
  Component,
  ElementRef,
  type OnDestroy,
  PLATFORM_ID,
  inject,
  input,
  output,
  signal,
  viewChild,
} from "@angular/core";

export interface AutoRefreshProps {
  /** Milliseconds between two refreshes. */
  interval: number;
}

@Component({
  selector: "uf-auto-refresh",
  imports: [ScopeAttributes, Fallthrough],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let enabled = this.enabled();
    <section
      class="auto-refresh"
      aria-label="Auto-refresh"
      [class]="this.class()"
      [style]="this.style()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      [ufScope]="this.host"
      #ufElement
    >
      <button type="button" [attr.aria-pressed]="enabled" (click)="toggle()">Auto-refresh</button>
      <p role="status">{{ enabled ? "Refreshing" : "Paused" }}</p>
    </section>
  `,
})
export default class AutoRefresh implements OnDestroy {
  readonly interval = input.required<number>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  readonly refresh = output<number>();
  readonly ufElement = viewChild<ElementRef<HTMLElement>>("ufElement");
  private readonly platformId = inject(PLATFORM_ID);
  private readonly tick = () => {
    this.refreshes += 1;
    this.refresh.emit(this.refreshes);
  };
  protected readonly enabled = signal(false);
  private timer: ReturnType<typeof setInterval> | undefined;
  private refreshes = 0;

  ngOnDestroy(): void {
    if (isPlatformBrowser(this.platformId)) {
      clearInterval(this.timer);
    }
  }

  protected toggle() {
    if (this.enabled()) {
      clearInterval(this.timer);
      this.enabled.set(false);
    } else {
      this.timer = setInterval(this.tick, this.interval());
      this.enabled.set(true);
    }
  }
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
