import { isPlatformBrowser } from "@angular/common";
import {
  Component,
  Directive,
  ElementRef,
  type OnDestroy,
  type OnInit,
  PLATFORM_ID,
  Renderer2,
  inject,
  input,
  output,
  signal,
} from "@angular/core";

export interface AutoRefreshProps {
  /** Milliseconds between two refreshes. */
  interval: number;
}

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
  selector: "uf-auto-refresh",
  imports: [ScopeAttributes],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let enabled = this.enabled();
    <section
      class="auto-refresh"
      aria-label="Auto-refresh"
      [class]="this.class()"
      [style]="this.style()"
      [ufScope]="this.host"
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
  readonly refresh = output<number>();
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
