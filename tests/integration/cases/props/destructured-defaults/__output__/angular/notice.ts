import {
  Component,
  Directive,
  ElementRef,
  type OnInit,
  Renderer2,
  inject,
  input,
} from "@angular/core";

export interface NoticeProps {
  message: string;
  title?: string;
  tone?: "info" | "warning";
  priority?: number;
  expanded?: boolean;
  tags?: string[];
  author?: { name: string };
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
  selector: "uf-notice",
  imports: [ScopeAttributes],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let message = this.message();
    @let title = this.title();
    @let tone = this.tone();
    @let priority = this.priority();
    @let expanded = this.expanded();
    @let tags = this.tags();
    @let author = this.author();
    <section
      class="notice"
      [attr.aria-label]="title"
      [attr.data-tone]="tone"
      [class]="this.class()"
      [style]="this.style()"
      [ufScope]="this.host"
    >
      <h2>{{ title }}</h2>
      <p>{{ message }}</p>
      <details [attr.open]="expanded ? '' : null">
        <summary>Priority {{ priority }}</summary>
        <p>Tagged {{ tags.join(", ") }}, posted by {{ author.name }}.</p>
      </details>
    </section>
  `,
})
export default class Notice {
  readonly message = input.required<string>();
  readonly title = input<string, string | undefined>("Notice", {
    transform: (value) => (value === undefined ? "Notice" : value),
  });
  readonly tone = input<"info" | "warning", "info" | "warning" | undefined>("info", {
    transform: (value) => (value === undefined ? "info" : value),
  });
  readonly priority = input<number, number | undefined>(1, {
    transform: (value) => (value === undefined ? 1 : value),
  });
  readonly expanded = input<boolean, boolean | undefined>(false, {
    transform: (value) => (value === undefined ? false : value),
  });
  readonly tags = input<string[], string[] | undefined>(["general"], {
    transform: (value) => (value === undefined ? ["general"] : value),
  });
  readonly author = input<{ name: string }, { name: string } | undefined>(
    { name: "System" },
    { transform: (value) => (value === undefined ? { name: "System" } : value) },
  );
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
