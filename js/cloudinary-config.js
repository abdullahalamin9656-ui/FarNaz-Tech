/* ==========================================================
   FarNaz Tech – Cloudinary (Stage 4)
   Public values only. NEVER put the Cloudinary API Secret here.

   window.FTCloud.upload(file, {onProgress})  -> {url, publicId, width, height}
   window.FTCloud.uploadMany(files, {onEach, onProgress})
   window.FTCloud.optimize(url, {w, h})       -> faster, resized delivery URL
   window.FTCloud.replace(oldPublicId, file)  -> uploads new, then deletes old
   window.FTCloud.remove(publicId)            -> deletes via secure worker
   ========================================================== */
(function () {
  "use strict";

  var CFG = {
    cloudName: "fdskxp7c",
    uploadPreset: "farnaz_products",   // must be an UNSIGNED preset
    // Paste your Cloudflare Worker URL here after you deploy it (see worker/ file).
    // Empty = image deletion is skipped (uploads still work).
    deleteEndpoint: "",
    maxFileMB: 10,                     // reject files bigger than this
    maxDim: 1600,                      // longest side after compression (px)
    quality: 0.82                      // JPEG quality after compression
  };

  var ALLOWED = ["image/jpeg", "image/png", "image/webp"];

  function validate(file) {
    return new Promise(function (resolve, reject) {
      if (!file) return reject(new Error("No file selected"));
      if (ALLOWED.indexOf(file.type) === -1) return reject(new Error(file.name + ": only JPG, PNG or WebP images are allowed"));
      if (file.size > CFG.maxFileMB * 1024 * 1024) return reject(new Error(file.name + ": larger than " + CFG.maxFileMB + " MB"));
      resolve(file);
    });
  }

  function loadImage(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () { URL.revokeObjectURL(url); resolve(img); };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error(file.name + ": could not read image")); };
      img.src = url;
    });
  }

  // Shrinks big photos in the browser so uploads are fast and pages load fast.
  function compress(file) {
    return loadImage(file).then(function (img) {
      var w = img.naturalWidth, h = img.naturalHeight;
      var small = Math.max(w, h) <= CFG.maxDim && file.size < 400 * 1024;
      if (small) return file;
      var scale = Math.min(1, CFG.maxDim / Math.max(w, h));
      var cw = Math.round(w * scale), ch = Math.round(h * scale);
      var canvas = document.createElement("canvas");
      canvas.width = cw; canvas.height = ch;
      var ctx = canvas.getContext("2d");
      ctx.fillStyle = "#ffffff";           // PNG transparency -> white background
      ctx.fillRect(0, 0, cw, ch);
      ctx.drawImage(img, 0, 0, cw, ch);
      return new Promise(function (resolve) {
        canvas.toBlob(function (blob) {
          resolve(blob && blob.size < file.size ? blob : file);
        }, "image/jpeg", CFG.quality);
      });
    });
  }

  function upload(file, opts) {
    opts = opts || {};
    return validate(file).then(compress).then(function (blob) {
      return new Promise(function (resolve, reject) {
        var fd = new FormData();
        fd.append("file", blob, file.name);
        fd.append("upload_preset", CFG.uploadPreset);
        if (opts.tags) fd.append("tags", opts.tags);
        var x = new XMLHttpRequest();
        x.open("POST", "https://api.cloudinary.com/v1_1/" + CFG.cloudName + "/image/upload");
        if (opts.onProgress) {
          x.upload.onprogress = function (e) {
            if (e.lengthComputable) opts.onProgress(Math.round((e.loaded / e.total) * 100));
          };
        }
        x.onload = function () {
          var j = null;
          try { j = JSON.parse(x.responseText); } catch (e) {}
          if (x.status >= 200 && x.status < 300 && j && j.secure_url) {
            resolve({ url: j.secure_url, publicId: j.public_id, width: j.width, height: j.height });
          } else {
            reject(new Error((j && j.error && j.error.message) || "Upload failed (" + x.status + ")"));
          }
        };
        x.onerror = function () { reject(new Error("Network error while uploading")); };
        x.send(fd);
      });
    });
  }

  // Uploads files one after another (gentler on mobile data). Failed files are reported, not fatal.
  function uploadMany(files, opts) {
    opts = opts || {};
    var list = Array.prototype.slice.call(files || []);
    var done = [], failed = [];
    return list.reduce(function (chain, file, i) {
      return chain.then(function () {
        return upload(file, {
          tags: opts.tags,
          onProgress: function (p) { if (opts.onProgress) opts.onProgress(i, p, file); }
        }).then(function (r) {
          done.push(r);
          if (opts.onEach) opts.onEach(i, r, null);
        }).catch(function (err) {
          failed.push({ file: file.name, error: err.message });
          if (opts.onEach) opts.onEach(i, null, err);
        });
      });
    }, Promise.resolve()).then(function () { return { uploaded: done, failed: failed }; });
  }

  // Adds Cloudinary's automatic format + quality + width. Use this for every <img> on the site.
  function optimize(url, o) {
    o = o || {};
    if (typeof url !== "string" || url.indexOf("https://res.cloudinary.com/") !== 0) return url;
    var t = ["f_auto", "q_auto"];
    if (o.w) t.push("w_" + Math.round(o.w));
    if (o.h) t.push("h_" + Math.round(o.h));
    if (o.w || o.h) t.push("c_limit");     // never crop, never upscale -> aspect ratio kept
    return url.replace("/upload/", "/upload/" + t.join(",") + "/");
  }

  // Secure delete: the browser only sends the publicId + the admin's Firebase login token.
  // The Worker verifies the admin and holds the API Secret.
  function remove(publicId) {
    if (!publicId) return Promise.resolve({ skipped: true });
    if (!CFG.deleteEndpoint) return Promise.resolve({ skipped: true, reason: "deleteEndpoint not set" });
    if (typeof firebase === "undefined" || !firebase.auth().currentUser) {
      return Promise.reject(new Error("Admin must be signed in to delete images"));
    }
    return firebase.auth().currentUser.getIdToken().then(function (token) {
      return fetch(CFG.deleteEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
        body: JSON.stringify({ publicId: publicId })
      });
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok) throw new Error(j.error || "Delete failed (" + r.status + ")");
        return j;
      });
    });
  }

  // Replace = upload the new image first; only delete the old one if the upload worked.
  function replace(oldPublicId, file, opts) {
    return upload(file, opts).then(function (res) {
      return remove(oldPublicId).catch(function () { /* old image stays orphaned; new one is safe */ }).then(function () { return res; });
    });
  }

  window.FTCloud = {
    config: CFG, validate: validate, compress: compress,
    upload: upload, uploadMany: uploadMany, optimize: optimize,
    remove: remove, replace: replace
  };
})();
