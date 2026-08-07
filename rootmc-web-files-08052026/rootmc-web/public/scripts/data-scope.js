/**
 * Shared scope helpers for rootmc.net/data (LIVE_DB only).
 */
(function (global) {
  var CLAIMS = "4963895e-0964-48b8-81b7-1f40a966e8be";
  var TOWNY = "15bbc057-4f8b-4761-abdb-7b7e4d9c7512";

  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function parsePath() {
    var parts = location.pathname.replace(/\/+$/, "").split("/").filter(Boolean);
    // ["data"] | ["data","towny"] | ["data","towny","balances"] | ["data","servers",uuid] | ["data","servers",uuid,"balances"]
    var scope = "";
    var serverId = "";
    var dataset = "";
    var apiServerKey = "";

    if (parts[0] !== "data") {
      return { scope: "", serverId: "", dataset: "", apiServerKey: "", basePath: "/data/" };
    }

    if (parts[1] === "servers") {
      scope = "servers";
      serverId = parts[2] || "";
      dataset = parts[3] || "";
      apiServerKey = serverId || "";
      return {
        scope: scope,
        serverId: serverId,
        dataset: dataset,
        apiServerKey: apiServerKey,
        basePath: serverId ? "/data/servers/" + encodeURIComponent(serverId) + "/" : "/data/servers/",
      };
    }

    scope = parts[1] || "";
    dataset = parts[2] || "";
    if (scope === "claims") {
      serverId = CLAIMS;
      apiServerKey = "claims";
    } else if (scope === "towny") {
      serverId = TOWNY;
      apiServerKey = "towny";
    } else if (scope === "official") {
      serverId = "official";
      apiServerKey = "official";
    } else {
      apiServerKey = scope;
      serverId = scope;
    }

    return {
      scope: scope,
      serverId: serverId,
      dataset: dataset,
      apiServerKey: apiServerKey,
      basePath: scope ? "/data/" + scope + "/" : "/data/",
    };
  }

  function liveServersUrl() {
    return "/api/rootmc/live/servers";
  }

  function liveServerUrl(apiServerKey) {
    return "/api/rootmc/live/servers/" + encodeURIComponent(apiServerKey);
  }

  function liveCatalogUrl(apiServerKey) {
    return liveServerUrl(apiServerKey) + "/catalog";
  }

  function liveDataUrl(apiServerKey, datasetId) {
    return liveServerUrl(apiServerKey) + "/data/" + encodeURIComponent(datasetId);
  }

  function scopeLabel(scope, serverId) {
    if (scope === "towny") return "Towny";
    if (scope === "claims") return "Claims";
    if (scope === "official") return "Official (combined)";
    if (scope === "servers" && serverId) return serverId.slice(0, 8) + "…";
    if (scope === "servers") return "All servers";
    return scope || "Data";
  }

  /** Known public webstat bases when LIVE_DB webstat_url is blank. */
  var WEBSTAT_FALLBACK = {
    towny: "https://towny.rootmc.net",
    claims: "https://claims.rootmc.net",
  };

  function webstatBaseFromDetail(detail, apiServerKey) {
    var url = "";
    if (detail && detail.servers && detail.servers[0] && detail.servers[0].connection) {
      url = String(detail.servers[0].connection.webstat_url || "").replace(/\/+$/, "");
    }
    if (!url && apiServerKey && WEBSTAT_FALLBACK[apiServerKey]) {
      url = WEBSTAT_FALLBACK[apiServerKey];
    }
    return url;
  }

  function webstatLogsUrl(webstatBase) {
    if (!webstatBase) return "";
    return String(webstatBase).replace(/\/+$/, "") + "/logs/";
  }

  function renderLogsLink(webstatBase) {
    var href = webstatLogsUrl(webstatBase);
    if (!href) return "";
    return (
      '<p class="data-logs-link">' +
      '<a class="data-logs-btn" href="' +
      esc(href) +
      '" target="_blank" rel="noopener">Live server logs</a>' +
      ' <span class="rmc-muted">· Root-Webstat on this host</span></p>'
    );
  }

  function renderTcSwitch(currentScope) {
    // Age Of Ava: Towny/Claims/gen switches retired. Future: Test↔Production only.
    var host = document.getElementById("data-switch");
    if (host) { host.innerHTML = ""; host.hidden = true; }
    return "";
  }

  async function fetchJson(url) {
    var res = await fetch(url, { cache: "no-store" });
    var data = null;
    try {
      data = await res.json();
    } catch (_e) {
      data = null;
    }
    if (!res.ok) {
      var detail = (data && (data.detail || data.error)) || "HTTP " + res.status;
      throw new Error(detail);
    }
    return data;
  }

  global.RootMcDataScope = {
    CLAIMS: CLAIMS,
    TOWNY: TOWNY,
    esc: esc,
    parsePath: parsePath,
    liveServersUrl: liveServersUrl,
    liveServerUrl: liveServerUrl,
    liveCatalogUrl: liveCatalogUrl,
    liveDataUrl: liveDataUrl,
    scopeLabel: scopeLabel,
    renderTcSwitch: renderTcSwitch,
    webstatBaseFromDetail: webstatBaseFromDetail,
    webstatLogsUrl: webstatLogsUrl,
    renderLogsLink: renderLogsLink,
    fetchJson: fetchJson,
  };
})(window);

  // SINGULAR_SWITCH_CUTOFF — Age of Ava: no Towny/Claims/gen switcher
  var _origMount = typeof mountScopeSwitch === "function" ? mountScopeSwitch : null;
  function mountScopeSwitch() {
    var host = document.getElementById("data-switch");
    if (host) { host.innerHTML = ""; host.hidden = true; }
    document.querySelectorAll("[data-generation-switch], .generation-switch").forEach(function (el) { el.remove(); });
  }
