/**
 * Catalog page for /data/{scope}/ — LIVE_DB datasets only.
 */
(function () {
  var DS = window.RootMcDataScope;
  if (!DS) return;

  function el(id) {
    return document.getElementById(id);
  }

  async function load() {
    var parsed = DS.parsePath();
    var title = el("data-title");
    var meta = el("data-meta");
    var err = el("data-error");
    var root = el("data-catalog");
    var switchSlot = el("data-switch");

    if (switchSlot && (parsed.scope === "towny" || parsed.scope === "claims")) {
      switchSlot.innerHTML = DS.renderTcSwitch(parsed.scope);
    }

    if (title) {
      title.innerHTML =
        '<span class="gold">' +
        DS.esc(DS.scopeLabel(parsed.scope, parsed.serverId)) +
        "</span> data";
    }

    if (!parsed.apiServerKey && parsed.scope !== "servers") {
      if (meta) meta.textContent = "Pick a server scope.";
      return;
    }

    try {
      if (parsed.scope === "servers" && !parsed.serverId) {
        var list = await DS.fetchJson(DS.liveServersUrl());
        if (meta) {
          meta.textContent =
            (list.servers || []).length +
            " host(s) · source LIVE_DB · " +
            (list.computed_at || "");
        }
        root.innerHTML = (list.servers || [])
          .map(function (s) {
            var id = String(s.server_id || "");
            var name = s.display_name || id;
            var sync = s.last_sync_at ? " · synced " + s.last_sync_at : "";
            return (
              '<a class="data-catalog-card" href="/data/servers/' +
              encodeURIComponent(id) +
              '/">' +
              "<h2>" +
              DS.esc(name) +
              "</h2>" +
              '<p class="rmc-muted">' +
              DS.esc(s.role || "") +
              " · " +
              DS.esc(s.game_address || "") +
              DS.esc(sync) +
              "</p>" +
              "</a>"
            );
          })
          .join("");
        return;
      }

      var key = parsed.apiServerKey;
      var detailP = DS.fetchJson(DS.liveServerUrl(key)).catch(function () {
        return null;
      });
      var catalog = await DS.fetchJson(DS.liveCatalogUrl(key));
      var detail = await detailP;

      var syncLine = "";
      if (detail && detail.servers && detail.servers[0] && detail.servers[0].sync) {
        var sy = detail.servers[0].sync;
        syncLine =
          " · last sync " +
          (sy.last_sync_at || "—") +
          (sy.last_sync_ok ? " ok" : " (errors)");
      }
      if (meta) {
        meta.textContent =
          "LIVE_DB · " +
          (catalog.datasets || []).length +
          " datasets" +
          syncLine +
          " · " +
          (catalog.computed_at || "");
      }

      var webstatBase = DS.webstatBaseFromDetail(detail, key);
      var cards = (catalog.datasets || [])
        .map(function (d) {
          var href = parsed.basePath + encodeURIComponent(d.id) + "/";
          return (
            '<a class="data-catalog-card" href="' +
            href +
            '">' +
            "<h2>" +
            DS.esc(d.title || d.id) +
            "</h2>" +
            '<p class="rmc-muted">' +
            DS.esc(d.description || "") +
            "</p>" +
            '<p class="data-catalog-api"><code>' +
            DS.esc(d.api || "") +
            "</code></p>" +
            "</a>"
          );
        })
        .join("");
      if (webstatBase) {
        cards =
          '<a class="data-catalog-card data-catalog-card-logs" href="' +
          DS.esc(DS.webstatLogsUrl(webstatBase)) +
          '" target="_blank" rel="noopener">' +
          "<h2>Server logs</h2>" +
          '<p class="rmc-muted">Live latest.log tail + download on this host\u2019s Webstat site.</p>' +
          '<p class="data-catalog-api"><code>' +
          DS.esc(DS.webstatLogsUrl(webstatBase)) +
          "</code></p>" +
          "</a>" +
          cards;
      }
      root.innerHTML = cards;
      if (err) err.hidden = true;
    } catch (e) {
      if (err) {
        err.hidden = false;
        err.textContent = e instanceof Error ? e.message : String(e);
      }
      if (meta) meta.textContent = "Failed to load LIVE_DB catalog.";
      if (root) root.innerHTML = "";
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", load);
  } else {
    load();
  }
})();
