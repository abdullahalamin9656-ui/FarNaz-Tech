/* ==========================================================
   FarNaz Tech – Checkout (Stage 5)
   Creates the order in Firestore. Firestore Rules re-verify every
   product price, the delivery charge and the totals, so changing
   numbers in the browser cannot lower what the customer pays.
   Payment: Cash on Delivery, or bKash / Nagad "Send Money" with a
   Transaction ID that an admin verifies by hand (no gateway yet).
   ========================================================== */
(function (F) {
  "use strict";
  if (!document.getElementById("coGrid")) return;
  var D = F.D, $ = F.$, esc = F.esc, money = F.money, C = window.FTCart;

  var PAY_NUMBER = "01931070541";   // bKash / Nagad personal number for Send Money
  var DISTRICTS = ["Bagerhat","Bandarban","Barguna","Barishal","Bhola","Bogura","Brahmanbaria","Chandpur","Chapainawabganj","Chattogram","Chuadanga","Cox's Bazar","Cumilla","Dhaka","Dinajpur","Faridpur","Feni","Gaibandha","Gazipur","Gopalganj","Habiganj","Jamalpur","Jashore","Jhalokathi","Jhenaidah","Joypurhat","Khagrachhari","Khulna","Kishoreganj","Kurigram","Kushtia","Lakshmipur","Lalmonirhat","Madaripur","Magura","Manikganj","Meherpur","Moulvibazar","Munshiganj","Mymensingh","Naogaon","Narail","Narayanganj","Narsingdi","Natore","Netrokona","Nilphamari","Noakhali","Pabna","Panchagarh","Patuakhali","Pirojpur","Rajbari","Rajshahi","Rangamati","Rangpur","Satkhira","Shariatpur","Sherpur","Sirajganj","Sunamganj","Sylhet","Tangail","Thakurgaon"];
  var METHODS = [
    { id: "cod",   label: "Cash on Delivery", sub: "Pay in cash when your order arrives", icon: "banknote" },
    { id: "bkash", label: "bKash",  sub: "Send Money, then enter the Transaction ID", icon: "smartphone" },
    { id: "nagad", label: "Nagad",  sub: "Send Money, then enter the Transaction ID", icon: "smartphone" }
  ];
  var method = "cod", user = null, ls = [], placing = false, profileLoaded = false;

  function val(id) { var n = $("#" + id); return n ? n.value.trim() : ""; }
  function normPhone(v) {
    v = String(v || "").replace(/[\s\-()]/g, "");
    if (v.indexOf("+88") === 0) v = v.slice(3); else if (v.indexOf("88") === 0 && v.length === 13) v = v.slice(2);
    return v;
  }
  function makeOrderNo() {
    return "FT-" + Date.now().toString(36).toUpperCase().slice(-6) + Math.random().toString(36).slice(2, 5).toUpperCase();
  }

  /* ---------- order summary ---------- */
  function renderSummary() {
    var t = C.totals(ls);
    $("#sumLines").innerHTML = ls.map(function (l) {
      return '<div class="sum-line"><span>' + esc(l.p.name) + " × " + l.qty + "</span><b>" + money(F.finalPrice(l.p) * l.qty) + "</b></div>";
    }).join("");
    $("#sumTotals").innerHTML = C.totalsHTML(t);
    var why = C.blockReason(ls);
    $("#coWarn").textContent = why;
    $("#placeBtn").disabled = !!why || placing;
  }

  /* ---------- payment ---------- */
  function renderPay() {
    $("#payList").innerHTML = METHODS.map(function (m) {
      return '<label class="pay-opt' + (m.id === method ? " on" : "") + '"><input type="radio" name="pay" value="' + m.id + '"' + (m.id === method ? " checked" : "") + " />" +
        '<i data-lucide="' + m.icon + '"></i><span><b>' + esc(m.label) + "</b><small>" + esc(m.sub) + "</small></span></label>";
    }).join("");
    var info = $("#payInfo");
    if (method === "cod") {
      info.innerHTML = '<div class="pay-info">You pay the delivery person in cash. Please keep the exact amount ready: <b>' + money(C.totals(ls).total) + "</b>.</div>";
    } else {
      var name = method === "bkash" ? "bKash" : "Nagad";
      info.innerHTML = '<div class="pay-info"><b>How to pay with ' + name + '</b><ol>' +
        "<li>Open your " + name + " app and choose <b>Send Money</b>.</li>" +
        '<li>Send <b>' + money(C.totals(ls).total) + '</b> to <span class="pay-num">' + PAY_NUMBER + "</span>.</li>" +
        "<li>Enter the <b>Transaction ID (TrxID)</b> below.</li></ol>" +
        '<label class="f" id="fTrx"><span>' + name + ' Transaction ID *</span><input id="trxId" type="text" maxlength="20" autocomplete="off" autocapitalize="characters" placeholder="e.g. 8N7A6D5EF3" /></label>' +
        '<p class="pay-warn">This is a manual payment. Your order is confirmed after our team verifies the transaction. It is not an instant online payment.</p></div>';
    }
    F.icons();
  }

  /* ---------- account box ---------- */
  function fillProfile(u) {
    if (profileLoaded) return; profileLoaded = true;
    if (u.displayName && !val("fName")) $("#fName").value = u.displayName;
    if (u.email && !val("fEmail")) $("#fEmail").value = u.email;
    try {
      firebase.firestore().collection("users").doc(u.uid).get().then(function (s) {
        if (!s.exists) return;
        var d = s.data() || {};
        [["fName", "name"], ["fPhone", "phone"], ["fEmail", "email"], ["fAddress", "address"], ["fArea", "area"]].forEach(function (m) {
          if (!val(m[0]) && typeof d[m[1]] === "string") $("#" + m[0]).value = d[m[1]];
        });
        if (!val("fDistrict") && typeof d.district === "string") $("#fDistrict").value = d.district;
      }).catch(function () {});
    } catch (e) {}
  }

  function renderAccount() {
    var box = $("#accBox"); box.textContent = "";
    if (user) {
      var wrap = document.createElement("div"); wrap.className = "signed";
      var p = document.createElement("p"); p.innerHTML = "Signed in as <b></b>"; p.querySelector("b").textContent = user.email || "your account";
      var out = document.createElement("button"); out.type = "button"; out.className = "link-btn"; out.textContent = "Sign out";
      out.addEventListener("click", function () { FTAuth.signOut(); });
      wrap.appendChild(p); wrap.appendChild(out); box.appendChild(wrap);
      fillProfile(user);
    } else {
      var note = document.createElement("p"); note.className = "co-note"; note.style.margin = "0 0 12px";
      note.textContent = "Sign in or create a free account so you can track your order and see your order history.";
      box.appendChild(note);
      var form = document.createElement("div"); box.appendChild(form);
      FTAuth.mountForm(form, function () {});
    }
  }

  /* ---------- validation + placing ---------- */
  function markBad(id, on) { var f = $("#" + id); if (f && f.closest(".f")) f.closest(".f").classList.toggle("bad", !!on); }
  function validate(v) {
    ["fName", "fPhone", "fEmail", "fDistrict", "fArea", "fAddress", "trxId"].forEach(function (i) { markBad(i, false); });
    function bad(id, msg) { markBad(id, true); var n = $("#" + id); if (n) n.focus(); return msg; }
    if (v.name.length < 2) return bad("fName", "Please enter your full name.");
    if (!/^01[3-9]\d{8}$/.test(v.phone)) return bad("fPhone", "Enter a valid Bangladeshi mobile number (e.g. 01XXXXXXXXX).");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v.email) || v.email.length > 120) return bad("fEmail", "Please enter a valid email address.");
    if (!v.district) return bad("fDistrict", "Please select your district.");
    if (v.area.length < 2) return bad("fArea", "Please enter your area / thana.");
    if (v.address.length < 10) return bad("fAddress", "Please enter your full delivery address (house, road, landmark).");
    if (method !== "cod" && !/^[A-Za-z0-9]{6,20}$/.test(v.trx)) return bad("trxId", "Enter the Transaction ID from your " + (method === "bkash" ? "bKash" : "Nagad") + " payment (6–20 letters/numbers).");
    return "";
  }

  function place() {
    if (placing) return;
    ls = C.lines();
    if (!ls.length) { F.toast("Your cart is empty", "error"); return; }
    var why = C.blockReason(ls); if (why) { F.toast(why, "error"); return; }
    if (!user) {
      F.toast("Please sign in or create an account first", "error");
      $("#accBox").scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    var v = { name: val("fName"), phone: normPhone(val("fPhone")), email: val("fEmail"), district: val("fDistrict"),
              area: val("fArea"), address: val("fAddress"), notes: val("fNotes"), trx: method === "cod" ? "" : val("trxId").toUpperCase() };
    var err = validate(v);
    if (err) { F.toast(err, "error"); return; }

    var t = C.totals(ls);
    var order = {
      orderNo: makeOrderNo(),
      userId: user.uid,
      customer: { name: v.name, phone: v.phone, email: v.email, address: v.address, district: v.district, area: v.area, notes: v.notes.slice(0, 500) },
      items: ls.map(function (l) {
        return { productId: l.p.id, name: l.p.name, image: (l.p.images && l.p.images[0]) || "", qty: l.qty,
                 unitPrice: F.finalPrice(l.p), regularPrice: l.p.price };
      }),
      itemsTotal: t.itemsTotal, delivery: t.delivery, total: t.total,
      paymentMethod: method, paymentStatus: "unpaid", paymentTrxId: v.trx,
      status: "pending",
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    placing = true; var btn = $("#placeBtn"); btn.disabled = true; btn.textContent = "Placing your order…";
    var db = firebase.firestore();
    db.collection("orders").doc().set(order).then(function () {
      try {
        db.collection("users").doc(user.uid).set({ name: v.name, phone: v.phone, email: v.email, address: v.address,
          district: v.district, area: v.area, updatedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true }).catch(function () {});
      } catch (e) {}
      C.clear();
      showDone(order);
    }).catch(function (e) {
      placing = false; btn.disabled = false; btn.textContent = "Place order";
      if (e && e.code === "permission-denied") {
        try { localStorage.removeItem("ft_data_v1"); } catch (x) {}
        F.toast("Prices or stock changed. Please reload this page and try again.", "error");
      } else {
        F.toast("Could not place the order. Check your connection and try again.", "error");
      }
    });
  }

  function showDone(o) {
    $("#coGrid").hidden = true;
    var done = $("#coDone");
    var manual = o.paymentMethod !== "cod";
    done.innerHTML = '<i class="big-ic" data-lucide="check-circle-2"></i><h2>Thank you! Your order is placed</h2>' +
      '<div class="order-no">' + esc(o.orderNo) + "</div>" +
      "<p>" + (manual
        ? "We will verify your " + (o.paymentMethod === "bkash" ? "bKash" : "Nagad") + " payment (TrxID " + esc(o.paymentTrxId) + ") and then confirm your order."
        : "Please keep " + money(o.total) + " ready to pay on delivery.") + "</p>" +
      '<p>Total: <b>' + money(o.total) + "</b></p>" +
      '<a class="btn btn-primary" href="orders.html"><i data-lucide="package"></i> Track my order</a> ' +
      '<a class="btn btn-ghost" href="products.html">Continue shopping</a>';
    done.hidden = false;
    F.icons(); window.scrollTo({ top: 0, behavior: "smooth" });
  }

  F.ready(function () {
    F.init();
    ls = C.lines();
    if (!ls.length) { $("#coEmpty").hidden = false; return; }
    $("#coGrid").hidden = false;

    $("#fDistrict").innerHTML = '<option value="">Select district</option>' + DISTRICTS.map(function (d) {
      return '<option value="' + esc(d) + '">' + esc(d) + "</option>";
    }).join("");
    renderSummary(); renderPay();

    $("#payList").addEventListener("change", function (e) {
      if (e.target && e.target.name === "pay") { method = e.target.value; renderPay(); }
    });
    $("#placeBtn").addEventListener("click", place);

    FTAuth.boot().then(function (u) {
      user = u; renderAccount();
      FTAuth.onChange(function (nu) { user = nu; if (!nu) profileLoaded = false; renderAccount(); });
    });
  });
})(window.FTC);
