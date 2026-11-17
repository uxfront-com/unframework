import { loadUser } from "./api";
import Badge, { ToneKey } from "./badge";
import {
  Component,
  DestroyRef,
  Directive,
  ElementRef,
  type OnInit,
  PendingTasks,
  Renderer2,
  inject,
  input,
  signal,
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
  selector: "uf-panel",
  imports: [Badge, ScopeAttributes],
  providers: [{ provide: ToneKey, useValue: "calm" }],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @if (resolved()) {
      <section
        class="panel"
        [attr.aria-label]="user.name"
        [class]="this.class()"
        [style]="this.style()"
        [ufScope]="this.host"
      >
        <uf-badge />
        <ng-content />
      </section>
    }
  `,
})
export default class Panel implements OnInit {
  readonly id = input.required<string>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  private readonly pendingTasks = inject(PendingTasks);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly resolved = signal(false);
  protected user!: Awaited<ReturnType<typeof this.initialUser>>;

  ngOnInit(): void {
    this.pendingTasks.run(async () => {
      this.user = await this.initialUser();

      // Destroyed while it waited: the rest of the setup never runs.
      if (this.destroyRef.destroyed) return;

      this.resolved.set(true);
    });
  }

  private initialUser() {
    return loadUser(this.id());
  }
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
