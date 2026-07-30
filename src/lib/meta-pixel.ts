import { trackMetaBrowserEvent } from "@/lib/api/meta.functions";

type MetaEventName = "PageView" | "InitiateCheckout" | "Purchase";

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

const CHECKOUT_DATA = {
  currency: "BRL",
  value: 97,
  content_name: "MakersHub Anual",
  content_type: "product",
  content_ids: ["makershub-anual"],
};

function cookie(name: string): string | undefined {
  const prefix = `${name}=`;
  const item = document.cookie.split("; ").find((part) => part.startsWith(prefix));
  return item ? decodeURIComponent(item.slice(prefix.length)) : undefined;
}

function createEventId(eventName: MetaEventName): string {
  const random = crypto.randomUUID?.() ?? `${Date.now()}_${Math.random().toString(36).slice(2)}`;
  return `${eventName.toLowerCase()}_${random}`;
}

export function trackMetaPageView(): void {
  const eventId = createEventId("PageView");
  window.fbq?.("track", "PageView", {}, { eventID: eventId });
  void trackMetaBrowserEvent({
    data: {
      eventName: "PageView",
      eventId,
      eventSourceUrl: window.location.href,
      fbp: cookie("_fbp"),
      fbc: cookie("_fbc"),
    },
  }).catch(() => {});
}

export function trackMetaInitiateCheckout(): void {
  const storageKey = `mh_meta_checkout_${window.location.pathname}`;
  if (sessionStorage.getItem(storageKey)) return;
  sessionStorage.setItem(storageKey, "1");

  const eventId = createEventId("InitiateCheckout");
  window.fbq?.("track", "InitiateCheckout", CHECKOUT_DATA, { eventID: eventId });
  void trackMetaBrowserEvent({
    data: {
      eventName: "InitiateCheckout",
      eventId,
      eventSourceUrl: window.location.href,
      fbp: cookie("_fbp"),
      fbc: cookie("_fbc"),
    },
  }).catch(() => {});
}

export function trackMetaPurchaseBrowser(paymentId: string): void {
  const eventId = `purchase_${paymentId}`;
  const storageKey = `mh_meta_${eventId}`;
  if (localStorage.getItem(storageKey)) return;
  localStorage.setItem(storageKey, "1");
  window.fbq?.("track", "Purchase", CHECKOUT_DATA, { eventID: eventId });
}

type CheckoutStep =
  | "form_validated"
  | "payment_started"
  | "payment_failed"
  | "payment_confirmed"
  | "activation_opened"
  | "activation_completed";

// Eventos de diagnóstico do funil, sem dados pessoais. São custom events do
// Pixel e não alteram InitiateCheckout/Purchase nem sua deduplicação CAPI.
export function trackCheckoutStep(step: CheckoutStep, paymentMethod?: "pix" | "cartao"): void {
  const key = `mh_checkout_step_${step}_${paymentMethod ?? "none"}`;
  if (sessionStorage.getItem(key)) return;
  sessionStorage.setItem(key, "1");
  window.fbq?.("trackCustom", "MakersHubCheckoutStep", {
    step,
    ...(paymentMethod ? { payment_method: paymentMethod } : {}),
  });
}
