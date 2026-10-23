import {
  Component,
  Directive,
  ElementRef,
  type OnInit,
  Renderer2,
  inject,
  input,
} from "@angular/core";

export interface StatusPillProps {
  status: "active" | "paused" | "archived";
  size?: "small" | "large";
  level?: 1 | 2 | 3;
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
  selector: "uf-status-pill",
  imports: [ScopeAttributes],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let status = this.status();
    @let size = this.size();
    @let level = this.level();
    <span
      class="pill"
      [class]="['pill-' + status, 'pill-' + size, 'pill-level-' + level, this.class()].join(' ')"
      [style]="this.style()"
      [ufScope]="this.host"
    >{{ status === "active" ? "Active" : status === "paused" ? "Paused" : "Archived" }}{{ level === 3 ? " (critical)" : "" }}</span>
  `,
})
export default class StatusPill {
  readonly status = input.required<"active" | "paused" | "archived">();
  readonly size = input<"small" | "large", "small" | "large" | undefined>("small", {
    transform: (value) => (value === undefined ? "small" : value),
  });
  readonly level = input<1 | 2 | 3, 1 | 2 | 3 | undefined>(1, {
    transform: (value) => (value === undefined ? 1 : value),
  });
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
