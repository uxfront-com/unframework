import { isPlatformBrowser } from "@angular/common";
import {
  Component,
  Directive,
  type EffectRef,
  ElementRef,
  Injector,
  type OnDestroy,
  type OnInit,
  PLATFORM_ID,
  Renderer2,
  computed,
  effect,
  inject,
  input,
  output,
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
  selector: "uf-channel-picker",
  imports: [ScopeAttributes],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let channel = this.channel();
    <section
      class="channel-picker"
      aria-label="Channels"
      [class]="this.class()"
      [style]="this.style()"
      [ufScope]="this.host"
    >
      <p role="status">Channel: #{{ channel }}</p>
      <button type="button" (click)="onJoinRandom()">Join #random</button>
      <button type="button" (click)="onJoinGeneral()">Join #General</button>
    </section>
  `,
})
export default class ChannelPicker implements OnInit, OnDestroy {
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly join = output<string>();
  readonly leave = output<string>();
  private readonly injector = inject(Injector);
  private readonly platformId = inject(PLATFORM_ID);
  protected readonly channel = signal("general");
  private nameWatcher?: EffectRef;

  ngOnInit(): void {
    const currentName = computed(() => this.channel().toLowerCase());
    this.nameWatcher = effect(
      (onCleanup) => {
        const name = currentName();
        if (!isPlatformBrowser(this.platformId)) return;
        untracked(() => {
          this.join.emit(name);
          onCleanup(() => {
            this.leave.emit(name);
          });
        });
      },
      { injector: this.injector },
    );
  }

  ngOnDestroy(): void {
    // Before Angular stops the outputs: a cleanup may still emit, as on every target.
    this.nameWatcher?.destroy();
  }

  protected onJoinRandom() {
    this.channel.set("random");
  }

  protected onJoinGeneral() {
    this.channel.set("General");
  }
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
