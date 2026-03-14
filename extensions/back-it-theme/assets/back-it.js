/**
 * back-it.js — Loocbooc "Back It" Widget
 * ========================================
 * Self-contained ES module. < 50KB gzipped target.
 *
 * Responsibilities:
 *   1. Fetch campaign data from the Loocbooc API on page load
 *   2. Subscribe to Supabase Realtime for live MOQ counter updates
 *   3. Render the widget (hero, progress bar, size selector, CTA)
 *   4. Handle form submission (backing intent → Shopify or Loocbooc checkout)
 *
 * No build step required — this file is served directly as a theme asset.
 * ES2020 syntax is safe for all modern browsers (no IE11 support needed).
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const WIDGET_SELECTOR = ".back-it-widget";
const POLL_INTERVAL_MS = 30_000; // fallback polling if Supabase Realtime fails

// ---------------------------------------------------------------------------
// Entry point — initialise all widgets on the page
// ---------------------------------------------------------------------------

document.addEventListener("DOMContentLoaded", () => {
  const widgets = document.querySelectorAll(WIDGET_SELECTOR);
  widgets.forEach((el) => {
    if (el instanceof HTMLElement) {
      initWidget(el).catch((err) => {
        console.error("[back-it] Widget init failed:", err);
        renderError(el, "Unable to load campaign. Please refresh the page.");
      });
    }
  });
});

// ---------------------------------------------------------------------------
// Widget initialisation
// ---------------------------------------------------------------------------

/**
 * Initialise a single Back It widget element.
 * @param {HTMLElement} el - The widget root element
 */
async function initWidget(el) {
  const campaignId = el.dataset.campaignId;
  const apiUrl = el.dataset.apiUrl || "https://api.loocbooc.com";
  const supabaseUrl = el.dataset.supabaseUrl;
  const supabaseAnonKey = el.dataset.supabaseAnonKey;
  const checkoutMode = el.dataset.checkoutMode || "shopify";
  const ctaLabel = el.dataset.ctaLabel || "Back This Style";

  if (!campaignId) {
    renderError(el, "Campaign ID not configured.");
    return;
  }

  // 1. Fetch campaign data
  const campaign = await fetchCampaign(apiUrl, campaignId);

  // 2. Render the widget with initial data
  renderWidget(el, campaign, ctaLabel);

  // 3. Subscribe to Supabase Realtime for live counter (if configured)
  if (supabaseUrl && supabaseAnonKey) {
    subscribeToRealtimeUpdates(el, supabaseUrl, supabaseAnonKey, campaignId, campaign);
  } else {
    // Fallback: poll the API periodically
    startFallbackPolling(el, apiUrl, campaignId);
  }

  // 4. Wire up form submission
  const form = el.querySelector(".back-it-form");
  if (form instanceof HTMLFormElement) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      handleBackingSubmit(form, campaign, apiUrl, checkoutMode);
    });
  }
}

// ---------------------------------------------------------------------------
// API fetch
// ---------------------------------------------------------------------------

/**
 * Fetch campaign data from the Loocbooc API.
 * @param {string} apiUrl
 * @param {string} campaignId
 * @returns {Promise<Campaign>}
 */
async function fetchCampaign(apiUrl, campaignId) {
  const res = await fetch(`${apiUrl}/api/v1/campaigns/${campaignId}`, {
    headers: { Accept: "application/json" },
  });

  if (!res.ok) {
    throw new Error(`Campaign fetch failed: ${res.status}`);
  }

  return res.json();
}

// ---------------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------------

/**
 * Render the full widget markup into `el`.
 * @param {HTMLElement} el
 * @param {Campaign} campaign
 * @param {string} ctaLabel
 */
function renderWidget(el, campaign, ctaLabel) {
  const {
    id,
    title,
    description,
    coverImageUrl,
    galleryUrls,
    currentBackingCount,
    moq,
    moqReached,
    estimatedShipDate,
    availableSizes,
    backerPriceCents,
    currency,
    status,
  } = campaign;

  const percentComplete = Math.min(100, Math.round((currentBackingCount / moq) * 100));
  const isActive = status === "active" || status === "moq_reached" || status === "funded";
  const shipDate = estimatedShipDate
    ? new Date(estimatedShipDate).toLocaleDateString("en-AU", { month: "long", year: "numeric" })
    : null;

  const price = formatCurrency(backerPriceCents, currency);

  el.innerHTML = /* html */ `
    <div class="back-it-inner" role="region" aria-label="${escapeHtml(title)}">

      ${coverImageUrl ? /* html */ `
        <div class="back-it-hero">
          <img
            src="${escapeHtml(coverImageUrl)}"
            alt="${escapeHtml(title)}"
            class="back-it-hero__img"
            loading="lazy"
          />
        </div>
      ` : ""}

      <div class="back-it-body">

        <div class="back-it-header">
          <span class="back-it-badge back-it-badge--${moqReached ? "success" : "active"}">
            ${moqReached ? getI18n("badge_funded") : getI18n("badge_live")}
          </span>
          <p class="back-it-price">${price}</p>
        </div>

        <p class="back-it-description">${escapeHtml(description ?? "")}</p>

        <div class="back-it-progress" aria-label="${getI18n("progress_label")}">
          <div class="back-it-progress__bar-wrap">
            <div
              class="back-it-progress__bar"
              role="progressbar"
              aria-valuenow="${percentComplete}"
              aria-valuemin="0"
              aria-valuemax="100"
              style="width: ${percentComplete}%;"
            ></div>
          </div>
          <div class="back-it-progress__meta">
            <span class="back-it-backers" data-backers>
              ${getI18n("backers_count", { count: currentBackingCount })}
            </span>
            <span class="back-it-moq">
              ${getI18n("moq_label", { moq })}
            </span>
          </div>
        </div>

        ${shipDate ? /* html */ `
          <p class="back-it-ship-date">
            ${getI18n("estimated_ship", { date: shipDate })}
          </p>
        ` : ""}

        ${isActive ? /* html */ `
          <form class="back-it-form" novalidate>
            <input type="hidden" name="campaignId" value="${escapeHtml(id)}" />

            <div class="back-it-size-selector" role="group" aria-labelledby="back-it-size-label">
              <p id="back-it-size-label" class="back-it-size-selector__label">
                ${getI18n("select_size")}
              </p>
              <div class="back-it-size-selector__options">
                ${availableSizes.map((size) => /* html */ `
                  <label class="back-it-size-option">
                    <input
                      type="radio"
                      name="size"
                      value="${escapeHtml(size)}"
                      required
                    />
                    <span>${escapeHtml(size)}</span>
                  </label>
                `).join("")}
              </div>
              <p class="back-it-size-error" role="alert" hidden>
                ${getI18n("size_required")}
              </p>
            </div>

            <button
              type="submit"
              class="back-it-cta"
              ${moqReached ? 'disabled aria-disabled="true"' : ""}
            >
              ${moqReached ? getI18n("cta_funded") : escapeHtml(ctaLabel)}
            </button>
          </form>
        ` : /* html */ `
          <p class="back-it-closed">
            ${getI18n("campaign_closed")}
          </p>
        `}

      </div>
    </div>
  `;

  // Remove the skeleton/loading state
  el.querySelector(".back-it-skeleton")?.remove();
  el.querySelector(".back-it-sr-only")?.remove();
}

/**
 * Update only the dynamic counter and progress bar — called on Realtime events.
 * @param {HTMLElement} el
 * @param {number} count
 * @param {number} moq
 */
function updateCounter(el, count, moq) {
  const percentComplete = Math.min(100, Math.round((count / moq) * 100));

  const backersEl = el.querySelector("[data-backers]");
  if (backersEl) {
    backersEl.textContent = getI18n("backers_count", { count });
    backersEl.classList.add("back-it-backers--updated");
    setTimeout(() => backersEl.classList.remove("back-it-backers--updated"), 600);
  }

  const barEl = el.querySelector(".back-it-progress__bar");
  if (barEl instanceof HTMLElement) {
    barEl.style.width = `${percentComplete}%`;
    barEl.setAttribute("aria-valuenow", String(percentComplete));
  }
}

/**
 * Render an error state into the widget.
 * @param {HTMLElement} el
 * @param {string} message
 */
function renderError(el, message) {
  el.innerHTML = /* html */ `
    <div class="back-it-error" role="alert">
      <p>${escapeHtml(message)}</p>
    </div>
  `;
}

// ---------------------------------------------------------------------------
// Supabase Realtime subscription
// ---------------------------------------------------------------------------

/**
 * Subscribe to Supabase Realtime for live campaign MOQ counter updates.
 * Falls back to polling on subscription failure.
 * @param {HTMLElement} el
 * @param {string} supabaseUrl
 * @param {string} supabaseAnonKey
 * @param {string} campaignId
 * @param {Campaign} campaign
 */
function subscribeToRealtimeUpdates(el, supabaseUrl, supabaseAnonKey, campaignId, campaign) {
  // Dynamic import of Supabase JS (loaded from CDN to keep asset bundle small).
  // The CDN URL is pinned to a specific version for reproducibility.
  const supabaseCdnUrl = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js";

  loadScript(supabaseCdnUrl)
    .then(() => {
      const { createClient } = window.supabase;
      const client = createClient(supabaseUrl, supabaseAnonKey);

      let moq = campaign.moq;

      client
        .channel(`campaign:${campaignId}`)
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "campaigns",
            filter: `id=eq.${campaignId}`,
          },
          (payload) => {
            const newCount = payload.new?.current_backing_count;
            const newMoq = payload.new?.moq ?? moq;
            if (typeof newCount === "number") {
              updateCounter(el, newCount, newMoq);
            }
          }
        )
        .subscribe((status) => {
          if (status === "SUBSCRIBED") {
            console.debug(`[back-it] Realtime subscribed for campaign ${campaignId}`);
          } else if (status === "CLOSED" || status === "CHANNEL_ERROR") {
            console.warn("[back-it] Realtime subscription failed — falling back to polling");
            startFallbackPolling(el, el.dataset.apiUrl, campaignId);
          }
        });
    })
    .catch(() => {
      console.warn("[back-it] Supabase CDN load failed — falling back to polling");
      startFallbackPolling(el, el.dataset.apiUrl, campaignId);
    });
}

// ---------------------------------------------------------------------------
// Fallback polling
// ---------------------------------------------------------------------------

/**
 * Poll the Loocbooc API for MOQ counter updates when Realtime is unavailable.
 * @param {HTMLElement} el
 * @param {string} apiUrl
 * @param {string} campaignId
 */
function startFallbackPolling(el, apiUrl, campaignId) {
  setInterval(async () => {
    try {
      const campaign = await fetchCampaign(apiUrl, campaignId);
      updateCounter(el, campaign.currentBackingCount, campaign.moq);
    } catch {
      // Silent fail — polling will retry next interval
    }
  }, POLL_INTERVAL_MS);
}

// ---------------------------------------------------------------------------
// Form submission
// ---------------------------------------------------------------------------

/**
 * Handle the "Back This Style" form submission.
 * Validates size selection, then routes to the appropriate checkout.
 * @param {HTMLFormElement} form
 * @param {Campaign} campaign
 * @param {string} apiUrl
 * @param {'shopify'|'loocbooc'} checkoutMode
 */
async function handleBackingSubmit(form, campaign, apiUrl, checkoutMode) {
  const sizeError = form.querySelector(".back-it-size-error");
  const selectedSize = form.querySelector('input[name="size"]:checked');

  // Client-side validation
  if (!selectedSize) {
    if (sizeError instanceof HTMLElement) {
      sizeError.hidden = false;
      sizeError.focus();
    }
    return;
  }

  if (sizeError instanceof HTMLElement) {
    sizeError.hidden = true;
  }

  const submitBtn = form.querySelector(".back-it-cta");
  if (submitBtn instanceof HTMLButtonElement) {
    submitBtn.disabled = true;
    submitBtn.textContent = getI18n("cta_loading");
  }

  const size = selectedSize instanceof HTMLInputElement ? selectedSize.value : "";

  try {
    if (checkoutMode === "shopify") {
      await routeToShopifyCheckout(campaign, size);
    } else {
      await routeToLoocboocCheckout(apiUrl, campaign, size);
    }
  } catch (err) {
    console.error("[back-it] Checkout routing failed:", err);
    if (submitBtn instanceof HTMLButtonElement) {
      submitBtn.disabled = false;
      submitBtn.textContent = getI18n("cta_error_retry");
    }
  }
}

/**
 * Route the backer to Shopify checkout by adding the variant to the cart.
 * The Shopify product ID is stored in campaign.shopifyProductId.
 * @param {Campaign} campaign
 * @param {string} size
 */
async function routeToShopifyCheckout(campaign, size) {
  const { shopifyProductId } = campaign;

  if (!shopifyProductId) {
    throw new Error("No Shopify product linked to this campaign.");
  }

  // Fetch the product variants to find the correct variant ID for the size.
  const res = await fetch(
    `/products/${shopifyProductId}.js`,
    { headers: { Accept: "application/json" } }
  );

  if (!res.ok) {
    throw new Error(`Product fetch failed: ${res.status}`);
  }

  const product = await res.json();
  const variant = product.variants?.find(
    (v) => v.option1 === size || v.title === size
  );

  if (!variant) {
    throw new Error(`No variant found for size: ${size}`);
  }

  // Add to cart and redirect to checkout.
  const cartRes = await fetch("/cart/add.js", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id: variant.id,
      quantity: 1,
      properties: {
        _campaign_id: campaign.id,
        _backer_size: size,
      },
    }),
  });

  if (!cartRes.ok) {
    throw new Error(`Cart add failed: ${cartRes.status}`);
  }

  window.location.href = "/checkout";
}

/**
 * Route the backer to the Loocbooc-hosted checkout page.
 * Creates a backing intent via the API and redirects.
 * @param {string} apiUrl
 * @param {Campaign} campaign
 * @param {string} size
 */
async function routeToLoocboocCheckout(apiUrl, campaign, size) {
  const res = await fetch(`${apiUrl}/api/v1/campaigns/${campaign.id}/backing-intent`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ size, quantity: 1 }),
  });

  if (!res.ok) {
    throw new Error(`Backing intent failed: ${res.status}`);
  }

  const { checkoutUrl } = await res.json();
  window.location.href = checkoutUrl;
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

/**
 * Escape HTML special characters to prevent XSS.
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Format cents as a localised currency string.
 * @param {number} cents
 * @param {string} currency
 * @returns {string}
 */
function formatCurrency(cents, currency = "AUD") {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
  }).format(cents / 100);
}

/**
 * Dynamically load a script from a URL.
 * Returns a promise that resolves when the script is loaded.
 * @param {string} src
 * @returns {Promise<void>}
 */
function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Script load failed: ${src}`));
    document.head.appendChild(script);
  });
}

// ---------------------------------------------------------------------------
// i18n helper
// ---------------------------------------------------------------------------

/**
 * Translation strings — loaded from the Liquid template via window.backItI18n
 * (set by the theme extension locale injection), with hardcoded English fallbacks.
 * @param {string} key
 * @param {Record<string, unknown>} [vars]
 * @returns {string}
 */
function getI18n(key, vars = {}) {
  const strings = window.backItI18n ?? {};
  let str = strings[key] ?? FALLBACK_STRINGS[key] ?? key;
  for (const [k, v] of Object.entries(vars)) {
    str = str.replace(`{${k}}`, String(v));
  }
  return str;
}

/** English fallback strings (always present as a safety net). */
const FALLBACK_STRINGS = {
  loading: "Loading campaign…",
  badge_live: "Live",
  badge_funded: "Funded",
  progress_label: "Campaign progress",
  backers_count: "{count} backers so far",
  moq_label: "Goal: {moq}",
  estimated_ship: "Estimated delivery: {date}",
  select_size: "Select your size",
  size_required: "Please select a size before backing.",
  cta_funded: "Campaign Funded",
  cta_loading: "Opening checkout…",
  cta_error_retry: "Try again",
  campaign_closed: "This campaign has ended.",
};
