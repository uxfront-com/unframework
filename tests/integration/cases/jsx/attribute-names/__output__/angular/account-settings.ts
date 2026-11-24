import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import { isPlatformBrowser } from "@angular/common";
import {
  Component,
  Directive,
  ElementRef,
  type OnChanges,
  type OnDestroy,
  PLATFORM_ID,
  Renderer2,
  inject,
  input,
  viewChild,
} from "@angular/core";

export interface AccountSettingsProps {
  charset: string;
  bioId: string;
  bioLimit: number;
  locked: boolean;
  bannerCors: "anonymous" | "use-credentials";
  seatColumns: number;
  helpOrder: number;
}

/** A native listener of each event a consumer passes, by the event's name (ADR-0118). */
type Listeners = { [K in keyof HTMLElementEventMap]?: (event: HTMLElementEventMap[K]) => void };

/**
 * Puts what a consumer passes the component, and the component does not declare, on the element
 * that takes it (ADR-0118): the attributes, the consumer's winning over the element's own, and
 * the native listeners, which run after the element's own.
 */
@Directive({ selector: "[ufFallthrough]" })
export class Fallthrough implements OnChanges, OnDestroy {
  readonly ufFallthrough = input.required<{
    attributes: Record<string, unknown> | undefined;
    listeners: Listeners | undefined;
  }>();
  private readonly element = inject<ElementRef<Element>>(ElementRef);
  private readonly renderer = inject(Renderer2);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly listening = new Map<string, { handler: unknown; stop: () => void }>();
  private written: Record<string, unknown> = {};

  ngOnChanges(): void {
    const element = this.element.nativeElement;
    const { attributes = {}, listeners = {} } = this.ufFallthrough();
    for (const name of Object.keys(this.written)) {
      if (!(name in attributes)) this.renderer.removeAttribute(element, name);
    }
    for (const [name, value] of Object.entries(attributes)) {
      if (value === null || value === undefined) this.renderer.removeAttribute(element, name);
      else this.renderer.setAttribute(element, name, String(value));
    }
    this.written = attributes;
    if (!this.browser) return;
    const handlers = new Map(Object.entries(listeners));
    for (const [event, { handler, stop }] of this.listening) {
      if (handlers.get(event) === handler) continue;
      stop();
      this.listening.delete(event);
    }
    for (const [event, handler] of handlers) {
      if (handler === undefined || this.listening.has(event)) continue;
      this.listening.set(event, { handler, stop: this.renderer.listen(element, event, handler) });
    }
  }

  ngOnDestroy(): void {
    for (const { stop } of this.listening.values()) stop();
  }
}

@Component({
  selector: "uf-account-settings",
  imports: [ScopeAttributes, Fallthrough],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let charset = this.charset();
    @let bioId = this.bioId();
    @let bioLimit = this.bioLimit();
    @let locked = this.locked();
    @let bannerCors = this.bannerCors();
    @let seatColumns = this.seatColumns();
    @let helpOrder = this.helpOrder();
    <div
      class="account-settings"
      [class]="this.class()"
      [style]="this.style()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      [ufScope]="this.host"
      #ufElement
    >
      <form accept-charset="utf-8" aria-label="Profile">
        <img
          src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40'%3E%3Crect width='40' height='40' fill='%23345'/%3E%3C/svg%3E"
          alt="Avatar"
          width="40"
          height="40"
          crossorigin="anonymous"
        />
        <label for="display-name">Display name</label>
        <input
          id="display-name"
          type="text"
          name="display-name"
          maxlength="40"
          readonly
          placeholder="Ada"
        />
        <label [attr.for]="bioId">Bio</label>
        <textarea
          [attr.id]="bioId"
          name="bio"
          rows="3"
          [attr.maxlength]="bioLimit"
          [attr.readonly]="locked ? '' : null"
        ></textarea>
        <button type="button" tabindex="0">Profile help</button>
      </form>
      <form [attr.accept-charset]="charset" aria-label="Plan">
        <img
          src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='40'%3E%3Crect width='120' height='40' fill='%23563'/%3E%3C/svg%3E"
          alt="Team plan banner"
          width="120"
          height="40"
          [attr.crossorigin]="bannerCors"
        />
        <table>
          <tbody>
            <tr>
              <th scope="row">Plan</th>
              <td colspan="2">Team</td>
            </tr>
            <tr>
              <th scope="row">Seats</th>
              <td [attr.colspan]="seatColumns">12</td>
            </tr>
          </tbody>
        </table>
        <button type="button" [attr.tabindex]="helpOrder">Plan help</button>
      </form>
    </div>
  `,
})
export default class AccountSettings {
  readonly charset = input.required<string>();
  readonly bioId = input.required<string>();
  readonly bioLimit = input.required<number>();
  readonly locked = input.required<boolean>();
  readonly bannerCors = input.required<"anonymous" | "use-credentials">();
  readonly seatColumns = input.required<number>();
  readonly helpOrder = input.required<number>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  readonly ufElement = viewChild<ElementRef<HTMLDivElement>>("ufElement");
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
