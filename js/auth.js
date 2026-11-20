/* ==========================================================
   FarNaz Tech – Customer authentication (Stage 5)
   Email + password sign in / sign up using Firebase Auth.
   Exposes window.FTAuth. Admin login is added in Stage 6.
   ========================================================== */
(function () {
  "use strict";
  var auth = null, current = null, booted = null, listeners = [];

  function boot() {
    if (booted) return booted;
    booted = new Promise(function (resolve) {
      try {
        if (typeof firebase === "undefined" || !firebase.auth || !window.FT_FIREBASE_CONFIG) { resolve(null); return; }
        if (!firebase.apps.length) firebase.initializeApp(window.FT_FIREBASE_CONFIG);
        auth = firebase.auth();
        var first = true;
        auth.onAuthStateChanged(function (u) {
          current = u;
          if (first) { first = false; resolve(u); }
          listeners.slice().forEach(function (fn) { try { fn(u); } catch (e) {} });
        });
      } catch (e) { resolve(null); }
    });
    return booted;
  }

  function errorText(e) {
    var c = (e && e.code) || "";
    if (c === "auth/invalid-credential" || c === "auth/wrong-password" || c === "auth/user-not-found" || c === "auth/invalid-login-credentials") return "Wrong email or password.";
    if (c === "auth/email-already-in-use") return "This email already has an account. Please sign in.";
    if (c === "auth/weak-password") return "Password must be at least 6 characters.";
    if (c === "auth/invalid-email") return "Please enter a valid email address.";
    if (c === "auth/too-many-requests") return "Too many attempts. Please wait a few minutes and try again.";
    if (c === "auth/network-request-failed") return "Network problem. Check your connection and try again.";
    if (c === "auth/operation-not-allowed") return "Email sign-in is not enabled in Firebase yet.";
    return "Something went wrong. Please try again.";
  }

  function signIn(email, pw) {
    return boot().then(function () { return auth.signInWithEmailAndPassword(email, pw); }).then(function (r) { return r.user; });
  }

  function signUp(name, email, pw) {
    return boot().then(function () { return auth.createUserWithEmailAndPassword(email, pw); }).then(function (r) {
      var u = r.user;
      return u.updateProfile({ displayName: name }).catch(function () {}).then(function () {
        try {
          return firebase.firestore().collection("users").doc(u.uid).set({
            name: name, email: email, createdAt: firebase.firestore.FieldValue.serverTimestamp()
          }, { merge: true }).catch(function () {});
        } catch (e) {}
      }).then(function () { return u; });
    });
  }

  function reset(email) { return boot().then(function () { return auth.sendPasswordResetEmail(email); }); }
  function signOut() { return boot().then(function () { return auth.signOut(); }); }
  function onChange(fn) { listeners.push(fn); }

  /* ---------- small DOM builder (no innerHTML with data) ---------- */
  function el(tag, attrs, kids) {
    var n = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === "text") n.textContent = attrs[k];
      else if (k === "class") n.className = attrs[k];
      else n.setAttribute(k, attrs[k]);
    });
    (kids || []).forEach(function (c) { n.appendChild(c); });
    return n;
  }
  function field(label, id, type, ac, ph) {
    var inp = el("input", { id: id, type: type, autocomplete: ac, required: "required", maxlength: "120" });
    if (ph) inp.setAttribute("placeholder", ph);
    return el("label", { class: "f" }, [el("span", { text: label }), inp]);
  }

  // Draws the sign in / create account form inside `box`. onDone(user) runs after success.
  function mountForm(box, onDone) {
    var mode = "in";
    box.textContent = "";
    var tIn = el("button", { type: "button", class: "on", text: "Sign in" });
    var tUp = el("button", { type: "button", text: "Create account" });
    var tabs = el("div", { class: "auth-tabs" }, [tIn, tUp]);
    var form = el("form", { class: "auth-form", novalidate: "novalidate" });
    var msg = el("p", { class: "auth-msg", "aria-live": "polite" });
    var go = el("button", { type: "submit", class: "btn btn-primary btn-block", text: "Sign in" });
    var forgot = el("button", { type: "button", class: "link-btn", text: "Forgot password?" });

    var fName = field("Full name", "auName", "text", "name");
    var fEmail = field("Email", "auEmail", "email", "email", "you@example.com");
    var fPw = field("Password", "auPw", "password", "current-password", "At least 6 characters");
    fEmail.querySelector("input").setAttribute("inputmode", "email");
    form.appendChild(fName); form.appendChild(fEmail); form.appendChild(fPw);
    form.appendChild(go); form.appendChild(msg); form.appendChild(forgot);

    function setMode(m) {
      mode = m;
      tIn.className = m === "in" ? "on" : ""; tUp.className = m === "up" ? "on" : "";
      fName.hidden = m === "in";
      fPw.querySelector("input").setAttribute("autocomplete", m === "in" ? "current-password" : "new-password");
      go.textContent = m === "in" ? "Sign in" : "Create account";
      forgot.hidden = m !== "in";
      msg.textContent = ""; msg.className = "auth-msg";
    }
    function say(t, cls) { msg.textContent = t; msg.className = "auth-msg " + (cls || ""); }
    setMode("in");
    tIn.addEventListener("click", function () { setMode("in"); });
    tUp.addEventListener("click", function () { setMode("up"); });

    forgot.addEventListener("click", function () {
      var email = fEmail.querySelector("input").value.trim();
      if (!email) { say("Type your email above first, then tap Forgot password.", "bad"); return; }
      reset(email).then(function () { say("Password reset email sent. Check your inbox.", "ok"); })
        .catch(function (e) { say(errorText(e), "bad"); });
    });

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var name = fName.querySelector("input").value.trim();
      var email = fEmail.querySelector("input").value.trim();
      var pw = fPw.querySelector("input").value;
      if (mode === "up" && name.length < 2) { say("Please enter your full name.", "bad"); return; }
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { say("Please enter a valid email address.", "bad"); return; }
      if (pw.length < 6) { say("Password must be at least 6 characters.", "bad"); return; }
      go.disabled = true; say("Please wait…");
      (mode === "in" ? signIn(email, pw) : signUp(name, email, pw)).then(function (u) {
        go.disabled = false; say("");
        if (onDone) onDone(u);
      }).catch(function (err) { go.disabled = false; say(errorText(err), "bad"); });
    });

    box.appendChild(tabs); box.appendChild(form);
  }

  window.FTAuth = {
    boot: boot, signIn: signIn, signUp: signUp, signOut: signOut, reset: reset,
    onChange: onChange, mountForm: mountForm, errorText: errorText,
    user: function () { return current; }
  };
})();
