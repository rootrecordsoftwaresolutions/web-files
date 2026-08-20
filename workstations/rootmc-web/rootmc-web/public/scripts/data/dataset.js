/**
 * Dataset page for /data/{scope}/{dataset}/ — LIVE_DB only.
 */
(function () {
  var DS = window.RootMcDataScope;
  if (!DS) return;

  var WINDOWS = ["1h", "8h", "12h", "24h", "48h", "7d", "1m", "year"];

  function el(id) {
    return document.getElementById(id);
  }

  function fmt(n, unit) {
    if (n == null || !Number.isFinite(Number(n))) return "—";
    var v = Number(n);
    var s =
      Math.abs(v) >= 1000
        ? v.toLocaleString(undefined, { maximumFractionDigits: 2 })
        : v.toLocaleString(undefined, { maximumFractionDigits: 3 });
    return unit ? s + " " + unit : s;
  }

  function fmtPct(n) {
    if (n == null || !Number.isFinite(Number(n))) return "—";
    var v = Number(n);
    return (v > 0 ? "+" : "") + v.toFixed(2) + "%";
  }

  function pctClass(n) {
    if (n == null || !Number.isFinite(Number(n))) return "";
    if (Number(n) > 0) return "pct-up";
    if (Number(n) < 0) return "pct-down";
    return "";
  }

  function summaryHtml(summary, unit) {
    var cur = (summary && summary.pct_change) || {};
    var avg = (summary && summary.pct_change_average) || cur;
    var tot = (summary && summary.pct_change_total) || cur;
    var head =
      "<tr><th>Window</th><th>Current %Δ</th><th>Average %Δ</th><th>Total %Δ</th></tr>";
    var body = WINDOWS.map(function (w) {
      return (
        "<tr><td>" +
        w +
        '</td><td class="' +
        pctClass(cur[w]) +
        '">' +
        fmtPct(cur[w]) +
        '</td><td class="' +
        pctClass(avg[w]) +
        '">' +
        fmtPct(avg[w]) +
        '</td><td class="' +
        pctClass(tot[w]) +
        '">' +
        fmtPct(tot[w]) +
        "</td></tr>"
      );
    }).join("");
    return (
      '<div class="data-summary-nums">' +
      '<div class="data-stat"><span>Current</span><strong>' +
      fmt(summary && summary.current, unit) +
      "</strong></div>" +
      '<div class="data-stat"><span>Average</span><strong>' +
      fmt(summary && summary.average, unit) +
      "</strong></div>" +
      '<div class="data-stat"><span>Total</span><strong>' +
      fmt(summary && summary.total, unit) +
      "</strong></div>" +
      '<div class="data-stat"><span>Count</span><strong>' +
      (summary && summary.count != null ? String(summary.count) : "—") +
      "</strong></div></div>" +
      '<table class="data-table data-windows"><thead>' +
      head +
      "</thead><tbody>" +
      body +
      "</tbody></table>"
    );
  }

  function rowsHtml(data) {
    var rows = data.rows || [];
    if (!rows.length) return '<p class="rmc-muted">No rows in LIVE_DB mirror yet.</p>';

    if (data.id === "gold_found") {
      return (
        '<table class="data-table"><thead><tr><th>#</th><th>Player</th><th>Mined</th><th>Found</th><th>Events</th></tr></thead><tbody>' +
        rows
          .map(function (r, i) {
            return (
              "<tr><td>" +
              DS.esc(r.rank != null ? r.rank : i + 1) +
              "</td><td>" +
              DS.esc(r.player || "") +
              "</td><td>" +
              DS.esc(fmt(r.mined, "G")) +
              "</td><td>" +
              DS.esc(fmt(r.found, "G")) +
              "</td><td>" +
              DS.esc(r.events != null ? r.events : "—") +
              "</td></tr>"
            );
          })
          .join("") +
        "</tbody></table>"
      );
    }

    if (rows[0].player != null && rows[0].balance != null) {
      return (
        '<table class="data-table"><thead><tr><th>Player</th><th>Balance</th></tr></thead><tbody>' +
        rows
          .map(function (r) {
            return (
              "<tr><td>" +
              DS.esc(r.player) +
              "</td><td>" +
              DS.esc(fmt(r.balance, "G")) +
              "</td></tr>"
            );
          })
          .join("") +
        "</tbody></table>"
      );
    }

    if (rows[0].player != null && rows[0].seconds != null) {
      return (
        '<table class="data-table"><thead><tr><th>Player</th><th>Seconds</th></tr></thead><tbody>' +
        rows
          .map(function (r) {
            return (
              "<tr><td>" +
              DS.esc(r.player) +
              "</td><td>" +
              DS.esc(fmt(r.seconds, "s")) +
              "</td></tr>"
            );
          })
          .join("") +
        "</tbody></table>"
      );
    }

    if (rows[0].table != null) {
      return (
        '<table class="data-table"><thead><tr><th>Server</th><th>Table</th><th>Rows</th><th>Last ok</th><th>Error</th></tr></thead><tbody>' +
        rows
          .map(function (r) {
            return (
              "<tr><td>" +
              DS.esc(String(r.server_id || "").slice(0, 8)) +
              "</td><td>" +
              DS.esc(r.table) +
              "</td><td>" +
              DS.esc(r.row_count) +
              "</td><td>" +
              DS.esc(r.last_ok_at || "") +
              "</td><td>" +
              DS.esc(r.error || "") +
              "</td></tr>"
            );
          })
          .join("") +
        "</tbody></table>"
      );
    }

    // Generic: first object keys
    var keys = Object.keys(rows[0]).filter(function (k) {
      return k !== "players";
    });
    return (
      '<table class="data-table"><thead><tr>' +
      keys.map(function (k) {
        return "<th>" + DS.esc(k) + "</th>";
      }).join("") +
      "</tr></thead><tbody>" +
      rows
        .map(function (r) {
          return (
            "<tr>" +
            keys
              .map(function (k) {
                var v = r[k];
                if (v != null && typeof v === "object") v = JSON.stringify(v);
                return "<td>" + DS.esc(v) + "</td>";
              })
              .join("") +
            "</tr>"
          );
        })
        .join("") +
      "</tbody></table>"
    );
  }

  async function load() {
    var parsed = DS.parsePath();
    var title = el("data-title");
    var meta = el("data-meta");
    var err = el("data-error");
    var summary = el("data-summary");
    var rows = el("data-rows");
    var apiLink = el("data-api-link");
    var switchSlot = el("data-switch");
    var back = el("data-back");

    if (switchSlot && (parsed.scope === "towny" || parsed.scope === "claims")) {
      switchSlot.innerHTML = DS.renderTcSwitch(parsed.scope);
    }
    if (back) {
      back.href = parsed.basePath;
      back.textContent = "← " + DS.scopeLabel(parsed.scope, parsed.serverId) + " catalog";
    }

    if (!parsed.apiServerKey || !parsed.dataset) {
      if (meta) meta.textContent = "Missing scope or dataset.";
      return;
    }

    var api = DS.liveDataUrl(parsed.apiServerKey, parsed.dataset);
    if (apiLink) {
      apiLink.href = api;
      apiLink.textContent = api;
    }

    try {
      var data = await DS.fetchJson(api);
      if (title) title.textContent = data.title || parsed.dataset;
      if (meta) {
        meta.textContent =
          "LIVE_DB" +
          (data.mirror_table ? " · " + data.mirror_table : "") +
          (data.mysql_table ? " ← " + data.mysql_table : "") +
          " · " +
          (data.computed_at || "");
      }
      if (summary) summary.innerHTML = summaryHtml(data.summary || {}, data.unit || "");
      if (rows) rows.innerHTML = rowsHtml(data);
      if (err) err.hidden = true;
    } catch (e) {
      if (err) {
        err.hidden = false;
        err.textContent = e instanceof Error ? e.message : String(e);
      }
      if (meta) meta.textContent = "Failed to load dataset from LIVE_DB.";
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", load);
  } else {
    load();
  }
})();
