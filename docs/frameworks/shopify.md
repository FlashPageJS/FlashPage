# Shopify Liquid Integration Guide

Flash Page integrates seamlessly into **Shopify Online Store 2.0** themes (including Dawn, Refresh, Prestige, and custom themes) to accelerate product browsing while safeguarding shopping cart sessions.

---

## 1. Quick Integration via Theme Snippet

The cleanest method to install Flash Page in a Shopify theme is creating a dedicated Liquid snippet.

### Step 1: Create `snippets/flash-page.liquid`
In your Shopify Admin, navigate to **Online Store -> Themes -> Actions -> Edit Code**. Under the **Snippets** folder, click **Add a new snippet** named `flash-page.liquid`:

```liquid
{% comment %}
  Flash Page v1.2.1 - Enterprise Speculative Prefetching
{% endcomment %}

<!-- Flash Page Script with Theme Configuration -->
<script 
  type="module" 
  src="{{ 'flashpage.min.js' | asset_url }}"
  data-flash-intensity="65"
  data-flash-specrules="prerender"
  data-flash-cart-safeguards
  data-flash-priority-queue
  data-flash-preconnect-cdn
></script>

<script>
  // Extended Shopify route exclusions and configuration
  window.flashPageConfig = {
    intensity: 65,
    specrules: 'prerender',
    cartSafeguards: true,
    filter: function(url) {
      // Safeguard Shopify checkout and dynamic cart operations
      var path = url.pathname.toLowerCase();
      if (path.indexOf('/cart') !== -1 || path.indexOf('/checkout') !== -1) {
        return false;
      }
      if (path.indexOf('/account') !== -1 || path.indexOf('/challenge') !== -1) {
        return false;
      }
      return true;
    }
  };
</script>
```

### Step 2: Upload Assets
Under the **Assets** folder, click **Add a new asset** and upload `flashpage.min.js` from the Flash Page release.

### Step 3: Include in `layout/theme.liquid`
Open `layout/theme.liquid` and include the snippet immediately before the closing `</body>` tag:

```liquid
    {% render 'flash-page' %}
  </body>
</html>
```

---

## 2. Shopify Cart & Checkout Safeguards

E-commerce stores must never allow background speculative prefetch requests to trigger accidental purchases or modify cart quantities. Flash Page includes native protections for Shopify:

### Automatic Exclusions:
* `/cart` and `/cart/*`
* `/checkout` and Shopify Hosted Checkout domains (`checkout.shopify.com`)
* `/account`, `/account/login`, `/account/register`
* Bot challenge routes (`/challenge`)
* Ajax cart endpoints (`/cart/add.js`, `/cart/change.js`, `/cart/clear.js`)

### Cart Drawer & Quick Buy Button Shielding:
For themes using slide-out cart drawers (such as the Dawn theme cart drawer), attach `data-no-flash` to action buttons and remove links:

```liquid
<!-- snippets/cart-drawer.liquid -->
<button 
  type="submit" 
  name="checkout" 
  class="cart__checkout-button button"
  data-no-flash
>
  {{ 'sections.cart.checkout' | t }}
</button>

<!-- Cart Item Removal Link -->
<a 
  href="{{ item.url_to_remove }}" 
  class="button button--tertiary"
  data-no-flash
>
  {{ 'sections.cart.remove' | t }}
</a>
```

---

## 3. Highlighting High-Intent Product Links

In your product grid templates (e.g. `snippets/card-product.liquid`), you can prioritize prefetching for bestsellers or collection items:

```liquid
<!-- snippets/card-product.liquid -->
<a 
  href="{{ card_product.url }}" 
  class="full-unstyled-link"
  data-flash-priority="high"
  data-flash-specrules="prerender"
>
  {{ card_product.title | escape }}
</a>
```

---

## 4. Best Practices in Shopify

1. **Asset URL Filter**: Always load the script via `{{ 'flashpage.min.js' | asset_url }}` so Shopify serves it from its global Cloudflare CDN with aggressive HTTP caching.
2. **Third-Party Review Apps**: Flash Page's `MutationObserver` automatically binds to dynamic product reviews (Judge.me, Yotpo, Loox) when customer review modals or tabs open.
3. **Currency & Language Selectors**: If your store uses Shopify Markets with currency switchers (`/en-ca`, `/fr`), Flash Page seamlessly pre-warms localized routes.
