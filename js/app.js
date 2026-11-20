/* ==========================================================
   FarNaz Tech – Homepage logic (Stage 1)
   Reads from window.FT (sample-data.js). In Stage 3 the data
   source is swapped for Firestore; rendering code stays.
   ========================================================== */
(function () {
  "use strict";

  var D = window.FT;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* ---------- helpers ---------- */
  function esc(str) {
    return String(str).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function money(n) { return D.currency + Number(n).toLocaleString("en-US"); }
  function icons() { if (window.lucide && window.lucide.createIcons) window.lucide.createIcons(); }
  function byId(list, id) { return list.filter(function (x) { return x.id === id; })[0]; }
  function finalPrice(p) { return p.discount && p.discount < p.price ? p.discount : p.price; }
  function pct(p) { return p.discount && p.discount < p.price ? Math.round((1 - p.discount / p.price) * 100) : 0; }
  function safeGet(k, fb) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : fb; } catch (e) { return fb; } }
  function safeSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage blocked */ } }

  function toast(msg, type) {
    var wrap = $("#toastWrap");
    var t = document.createElement("div");
    t.className = "toast" + (type === "error" ? " error" : "");
    t.innerHTML = '<i data-lucide="' + (type === "error" ? "alert-circle" : "check-circle-2") + '"></i><span>' + esc(msg) + "</span>";
    wrap.appendChild(t);
    icons();
    setTimeout(function () {
      t.classList.add("out");
      setTimeout(function () { t.remove(); }, 320);
    }, 2600);
  }

  /* ---------- cart (localStorage until Stage 5) ---------- */
  var CART_KEY = "ft_cart";
  function getCart() { return safeGet(CART_KEY, []); }
  function updateCartBadge() {
    var n = getCart().reduce(function (s, i) { return s + i.qty; }, 0);
    var b = $("#cartCount");
    b.textContent = n;
    b.classList.remove("bump"); void b.offsetWidth; b.classList.add("bump");
  }
  function addToCart(id, qty) {
