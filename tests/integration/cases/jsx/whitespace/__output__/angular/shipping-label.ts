import { Component, input } from "@angular/core";

export interface ShippingLabelProps {
  recipient: string;
  street: string;
  city: string;
  postcode: string;
}

@Component({
  selector: "uf-shipping-label",
  host: { style: "display: contents" },
  preserveWhitespaces: false,
  template: `
    @let recipient = this.recipient();
    @let street = this.street();
    @let city = this.city();
    @let postcode = this.postcode();
    <article class="shipping-label" aria-label="Shipping label">
      <p><strong>To:</strong>&ngsp;{{ recipient }}</p>
      <p>
        <span class="shipping-label-city">{{ city }}</span>&ngsp;<span
          class="shipping-label-postcode"
        >{{ postcode }}</span>&ngsp;<span class="shipping-label-country">United Kingdom</span>
      </p>
      <p>{{ "\\u0020\\u0020Handle with care " }}</p>
      <pre>{{ recipient }}
{{ street }}
{{ city + "\\u0020\\u0020" + postcode }}</pre>
      <pre>Parcel:	1 of 2
Weight:	2.5 kg</pre>
      <p>Sent by <em>Unframework Ltd</em>, on two
lines.</p>
    </article>
  `,
})
export default class ShippingLabel {
  readonly recipient = input.required<string>();
  readonly street = input.required<string>();
  readonly city = input.required<string>();
  readonly postcode = input.required<string>();
}
