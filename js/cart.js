/* ==========================================================
   FarNaz Tech – Cart (Stage 5)
   The cart lives in the browser (localStorage "ft_cart", ids + quantities only).
   Prices ALWAYS come from the live product data, never from the cart,
   and Firestore Rules re-check them again when an order is created.
   Exposes window.FTCart (also used by checkout.js).
   ========================================================== */
(function (F) {
  "use strict";
  var D = F.D, $ = F.$, esc = F.esc, money = F.money;
  var MAX_QTY = 10, MAX_LINES = 8, KEY = "ft_cart";

  function thumb(u) {
    return typeof u === "string" && u.indexOf("https://res.cloudinary.com/") === 0
      ? u.replace("/upload/", "/upload/f_auto,q_auto,w_240,c_limit/") : u;
  }

  // Cart lines joined with live product data. Removes products that no longer exist
  // and trims quantities to the available stock.
  function lines() {
    var raw = F.getCart(), out = [], clean = [], changed = false;
    if (!D.products.length) return out;            // store data did not load: leave the cart untouched
    raw.forEach(function (c) {
      var p = F.byId(D.products, c.id);
      if (!p) { changed = true; return; }
      var q = Math.max(1, parseInt(c.qty, 10) || 1), cap = Math.min(MAX_QTY, p.stock);
      if (cap > 0 && q > cap) { q = cap; changed = true; }
      if (q > MAX_QTY) { q = MAX_QTY; changed = true; }
      clean.push({ id: p.id, qty: q });
      out.push({ p: p, qty: q, out: p.stock <= 0 });
    });
    if (changed) F.safeSet(KEY, clean);
    return out;
  }

  function totals(ls) {
    var sub = 0, items = 0;
    ls.forEach(function (l) { sub += l.p.price * l.qty; items += F.finalPrice(l.p) * l.qty; });
    var delivery = ls.length ? (Number(D.settings.deliveryCharge) || 0) : 0;
    return { sub: sub, discount: sub - items, itemsTotal: items, delivery: delivery, total: items + delivery };
  }

  function blockReason(ls) {
    for (var i = 0; i < ls.length; i++) if (ls[i].out) return "Remove out-of-stock items to continue.";
    if (ls.length > MAX_LINES) return "You can order up to " + MAX_LINES + " different products at a time. Please remove some.";
    return "";
  }

  function setQty(id, q) {
    var cart = F.getCart();
    cart.forEach(function (c) { if (c.id === id) c.qty = q; });
    F.safeSet(KEY, cart); F.updateCartBadge();
  }
  function remove(id) {
    F.safeSet(KEY, F.getCart().filter(function (c) { return c.id !== id; })); F.updateCartBadge();
  }
  function clear() { F.safeSet(KEY, []); F.updateCartBadge(); }

  function totalsHTML(t) {
    return '<div class="tot"><span>Subtotal</span><b>' + money(t.sub) + "</b></div>" +
      (t.discount > 0 ? '<div class="tot save"><span>Discount</span><b>−' + money(t.discount) + "</b></div>" : "") +
      '<div class="tot"><span>Delivery charge</span><b>' + (t.delivery ? money(t.delivery) : "Free") + "</b></div>" +
      '<div class="tot grand"><span>Total</span><b>' + money(t.total) + "</b></div>";
  }

  window.FTCart = { lines: lines, totals: totals, totalsHTML: totalsHTML, blockReason: blockReason, thumb: thumb,
    setQty: setQty, remove: remove, clear: clear, MAX_QTY: MAX_QTY, MAX_LINES: MAX_LINES };

  /* ---------- cart page ---------- */
  if (!$("#cartList")) return;

  function lineHTML(l) {
    var p = l.p, off = F.pct(p), img = p.images && p.images[0];
    var media = img ? '<img src="' + esc(thumb(img)) + '" alt="' + esc(p.name) + '" loading="lazy" decoding="async" />'
                    : '<i data-lucide="' + esc(p.icon) + '"></i>';
    var cap = Math.min(MAX_QTY, p.stock);
    var note = l.out ? '<span class="stock out">Out of stock</span>' : (p.stock <= 5 ? '<span class="stock low">Only ' + p.stock + " left</span>" : "");
    return '<div class="cl">' +
      '<a class="cl-img" href="product.html?id=' + esc(p.id) + '" aria-label="' + esc(p.name) + '">' + media + "</a>" +
      '<div class="cl-info">' +
        '<div class="cl-meta">' + esc(F.brandName(p.brand)) + "</div>" +
        '<a class="cl-title" href="product.html?id=' + esc(p.id) + '">' + esc(p.name) + "</a>" + note +
        '<div class="cl-row">' +
          '<div class="qty"><button type="button" data-cart="dec" data-id="' + esc(p.id) + '" aria-label="Decrease quantity"' + (l.qty <= 1 || l.out ? " disabled" : "") + ">−</button>" +
          "<span>" + l.qty + '</span><button type="button" data-cart="inc" data-id="' + esc(p.id) + '" aria-label="Increase quantity"' + (l.out || l.qty >= cap ? " disabled" : "") + ">+</button></div>" +
          '<div class="cl-price"><b>' + money(F.finalPrice(p) * l.qty) + "</b>" + (off ? "<s>" + money(p.price * l.qty) + "</s>" : "") + "</div>" +
        "</div>" +
        '<button type="button" class="cl-remove" data-cart="rm" data-id="' + esc(p.id) + '"><i data-lucide="trash-2"></i> Remove</button>' +
      "</div></div>";
  }

  function render() {
    var ls = lines();
    $("#cartEmpty").hidden = ls.length > 0;
    $("#cartGrid").hidden = ls.length === 0;
    var n = ls.reduce(function (s, l) { return s + l.qty; }, 0);
    $("#cartSub").textContent = n ? n + (n > 1 ? " items" : " item") + " in your cart" : "";
    $("#cartList").innerHTML = ls.map(lineHTML).join("");
    $("#cartSummary").innerHTML = totalsHTML(totals(ls));
    var why = blockReason(ls), btn = $("#cartCheckout");
    $("#cartWarn").textContent = why;
    btn.setAttribute("aria-disabled", why ? "true" : "false");
    btn.setAttribute("href", why ? "#" : "checkout.html");
    F.icons();
  }

  F.ready(function () {
    F.init();
    render();
    $("#cartList").addEventListener("click", function (e) {
      var b = e.target.closest("[data-cart]"); if (!b || b.disabled) return;
      var id = b.getAttribute("data-id"), act = b.getAttribute("data-cart");
      var cur = F.getCart().filter(function (c) { return c.id === id; })[0];
      if (act === "rm") remove(id);
      else if (cur && act === "inc") setQty(id, cur.qty + 1);
      else if (cur && act === "dec") setQty(id, Math.max(1, cur.qty - 1));
      render();
    });
    $("#cartClear").addEventListener("click", function () {
      if (window.confirm("Remove all items from your cart?")) { clear(); render(); }
    });
  });
})(window.FTC);
