/* ==========================================================
   FarNaz Tech – My Orders (Stage 5)
   Order history, order status, delivery tracking and cancelling
   an order while it is still Pending. Customers can only read
   their own orders (enforced by Firestore Rules).
   ========================================================== */
(function (F) {
  "use strict";
  if (!document.getElementById("orRoot")) return;
  var $ = F.$, esc = F.esc, money = F.money, C = window.FTCart;
  var STEPS = ["pending", "confirmed", "processing", "shipped", "delivered"];
  var LABEL = { pending: "Pending", confirmed: "Confirmed", processing: "Processing", shipped: "Shipped", delivered: "Delivered", cancelled: "Cancelled" };
  var PAY = { cod: "Cash on Delivery", bkash: "bKash", nagad: "Nagad" };
  var user = null;

  function when(ts) {
    try {
      var d = ts && ts.toDate ? ts.toDate() : null;
      return d ? d.toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" }) : "";
    } catch (e) { return ""; }
  }
  function millis(o) { var t = o.createdAt; return t && t.toMillis ? t.toMillis() : 0; }
  function payText(o) {
    var m = PAY[o.paymentMethod] || "—";
    if (o.paymentStatus === "paid") return m + " · Paid";
    if (o.paymentMethod === "cod") return m + " · Pay on delivery";
    return m + " · Awaiting verification" + (o.paymentTrxId ? " (TrxID " + o.paymentTrxId + ")" : "");
  }

  function trackHTML(status) {
    if (status === "cancelled") return '<p class="co-note" style="margin:12px 0 0"><b>This order was cancelled.</b></p>';
    var idx = STEPS.indexOf(status); if (idx < 0) idx = 0;
    return '<ol class="track" aria-label="Order tracking">' + STEPS.map(function (s, i) {
      return '<li class="' + (i <= idx ? "done" : "") + '">' + LABEL[s] + "</li>";
    }).join("") + "</ol>";
  }

  function itemHTML(it) {
    var img = typeof it.image === "string" && it.image.indexOf("https://") === 0 ? it.image : "";
    var media = img ? '<img src="' + esc(C.thumb(img)) + '" alt="" loading="lazy" decoding="async" />' : '<i data-lucide="package"></i>';
    var qty = Number(it.qty) || 0, unit = Number(it.unitPrice) || 0;
    return '<div class="oi"><div class="oi-img">' + media + '</div><div class="oi-name">' + esc(it.name || "Product") +
      "<small>Qty " + qty + " × " + money(unit) + "</small></div><b>" + money(unit * qty) + "</b></div>";
  }

  function cardHTML(row) {
    var o = row.data, c = o.customer || {}, st = LABEL[o.status] ? o.status : "pending";
    var items = Array.isArray(o.items) ? o.items : [];
    return '<article class="order-card">' +
      '<div class="oc-head"><div><b>' + esc(o.orderNo || row.id) + "</b><small>" + esc(when(o.createdAt)) + '</small></div><span class="badge-st ' + st + '">' + LABEL[st] + "</span></div>" +
      '<div class="oc-body">' + trackHTML(st) +
      '<div style="margin-top:10px">' + items.map(itemHTML).join("") + "</div>" +
      '<div class="oc-sum"><div class="tot"><span>Items</span><b>' + money(Number(o.itemsTotal) || 0) + "</b></div>" +
      '<div class="tot"><span>Delivery charge</span><b>' + (Number(o.delivery) ? money(Number(o.delivery)) : "Free") + "</b></div>" +
      '<div class="tot grand"><span>Total</span><b>' + money(Number(o.total) || 0) + "</b></div></div>" +
      '<div class="oc-info"><div><b>Payment:</b> ' + esc(payText(o)) + "</div>" +
      "<div><b>Deliver to:</b> " + esc([c.name, c.phone, c.address, c.area, c.district].filter(Boolean).join(", ")) + "</div></div>" +
      (st === "pending" ? '<div class="oc-actions"><button type="button" class="btn btn-sm btn-danger-o" data-cancel="' + esc(row.id) + '">Cancel order</button></div>' : "") +
      "</div></article>";
  }

  function showList(rows) {
    var box = $("#orList");
    if (!rows.length) {
      box.innerHTML = '<div class="co-empty"><i data-lucide="package-open"></i><h2>No orders yet</h2><p>When you place an order it will show up here.</p><a class="btn btn-primary" href="products.html">Start shopping</a></div>';
    } else box.innerHTML = rows.map(cardHTML).join("");
    F.icons();
  }

  function load() {
    var box = $("#orList");
    box.innerHTML = '<div class="skeleton-line"></div><div class="skeleton-line"></div>';
    firebase.firestore().collection("orders").where("userId", "==", user.uid).get().then(function (snap) {
      var rows = snap.docs.map(function (d) { return { id: d.id, data: d.data() }; });
      rows.sort(function (a, b) { return millis(b.data) - millis(a.data); });
      showList(rows);
    }).catch(function () {
      box.innerHTML = '<div class="co-empty"><h2>Could not load your orders</h2><p>Please check your connection and refresh the page.</p></div>';
    });
  }

  function render() {
    var authBox = $("#orAuth"), top = $("#orTop"), list = $("#orList");
    if (!user) {
      list.textContent = ""; top.hidden = true; authBox.hidden = false;
      authBox.innerHTML = '<div class="co-card" style="max-width:460px;margin:0 auto"><h2>Sign in to see your orders</h2><div id="orForm"></div></div>';
      FTAuth.mountForm($("#orForm"), function () {});
      return;
    }
    authBox.hidden = true; authBox.textContent = "";
    top.hidden = false; top.querySelector("b").textContent = user.email || "your account";
    load();
  }

  F.ready(function () {
    F.init();
    $("#orOut").addEventListener("click", function () { FTAuth.signOut(); });
    $("#orList").addEventListener("click", function (e) {
      var b = e.target.closest("[data-cancel]"); if (!b) return;
      if (!window.confirm("Cancel this order? This cannot be undone.")) return;
      b.disabled = true;
      firebase.firestore().collection("orders").doc(b.getAttribute("data-cancel")).update({
        status: "cancelled", updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      }).then(function () { F.toast("Order cancelled"); load(); })
        .catch(function () { b.disabled = false; F.toast("This order can no longer be cancelled. Please contact support.", "error"); });
    });
    FTAuth.boot().then(function (u) {
      user = u; render();
      FTAuth.onChange(function (nu) { user = nu; render(); });
    });
  });
})(window.FTC);
