/** Soft-read of connection preference + Solar/Cloudflare badge. */
(function () {
  var KEY = "rootmc_connection_preference";
  var TTL_MS = 15000;

  function cached() {
    try {
      var raw = sessionStorage.getItem(KEY);
      if (!raw) return null;
      var o = JSON.parse(raw);
      if (!o || !o.at || Date.now() - o.at > TTL_MS) return null;
      return o.data;
    } catch (e) {
      return null;
    }
  }

  function store(data) {
    try {
      sessionStorage.setItem(KEY, JSON.stringify({ at: Date.now(), data: data }));
    } catch (e) { /* ignore */ }
  }

  function activeProvider(data) {
    if (!data) return "unknown";
    if (data.active_provider === "solar" || data.active_provider === "cloudflare") {
      return data.active_provider;
    }
    return data.preference === "local" ? "solar" : data.preference === "cloudflare" ? "cloudflare" : "unknown";
  }

  function paintBadge(el, data) {
    if (!el) return;
    var p = activeProvider(data);
    el.dataset.provider = p;
    el.textContent = p === "solar" ? "Solar" : p === "cloudflare" ? "Cloudflare" : "…";
    el.title = p === "solar"
      ? "Active provider: Solar (primary)"
      : p === "cloudflare"
        ? "Active provider: Cloudflare (failover)"
        : "Active provider unknown";
    el.classList.toggle("is-solar", p === "solar");
    el.classList.toggle("is-cloudflare", p === "cloudflare");
  }

  function ensureBadge() {
    var existing = document.getElementById("rmc-active-provider");
    if (existing) return existing;
    var nav = document.querySelector(".rmc-nav") || document.querySelector("[data-site-nav]");
    if (!nav || !nav.parentElement) return null;
    var el = document.createElement("span");
    el.id = "rmc-active-provider";
    el.className = "rmc-active-provider";
    el.setAttribute("role", "status");
    el.setAttribute("aria-live", "polite");
    el.textContent = "…";
    if (!document.getElementById("rmc-active-provider-style")) {
      var style = document.createElement("style");
      style.id = "rmc-active-provider-style";
      style.textContent =
        ".rmc-active-provider{display:inline-block;margin-left:.75rem;font:600 .72rem/1.2 ui-monospace,Consolas,monospace;" +
        "letter-spacing:.04em;text-transform:uppercase;opacity:.85;border:1px solid currentColor;padding:.2rem .45rem}" +
        ".rmc-active-provider.is-solar{color:#1a7a3c;border-color:#1a7a3c}" +
        ".rmc-active-provider.is-cloudflare{color:#b45309;border-color:#b45309}";
      document.head.appendChild(style);
    }
    nav.parentElement.insertBefore(el, nav.nextSibling);
    return el;
  }

  window.RootMcConnectionPreference = {
    get: function () {
      return cached();
    },
    activeProvider: function (data) {
      return activeProvider(data || cached());
    },
    refresh: function () {
      var urls = [
        "/api/rootmc/connection-preference",
        "https://api.rootmc.net/api/rootmc/connection-preference",
        "https://api-local.rootmc.net/api/rootmc/connection-preference",
      ];
      var i = 0;
      function next() {
        if (i >= urls.length) return Promise.resolve(null);
        var u = urls[i++];
        return fetch(u, { cache: "no-store" })
          .then(function (r) {
            if (!r.ok) return next();
            return r.json().then(function (j) {
              store(j);
              paintBadge(ensureBadge(), j);
              return j;
            });
          })
          .catch(function () {
            return next();
          });
      }
      var hit = cached();
      if (hit) {
        paintBadge(ensureBadge(), hit);
        return Promise.resolve(hit);
      }
      return next();
    },
    mountBadge: function () {
      var el = ensureBadge();
      paintBadge(el, cached());
      return this.refresh();
    },
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      window.RootMcConnectionPreference.mountBadge();
    });
  } else {
    window.RootMcConnectionPreference.mountBadge();
  }
})();
