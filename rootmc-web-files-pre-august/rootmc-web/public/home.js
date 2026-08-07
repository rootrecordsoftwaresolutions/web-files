(function () {
  var SERVER_ID = "rootmc";
  var HERO_COUNT = 4;
  var TAPE_MIN = 12;

  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function el(id) {
    return document.getElementById(id);
  }

  function fmtGold(n) {
    if (!Number.isFinite(n)) return "—";
    return n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + " G";
  }

  function fmtPct24h(n) {
    if (!Number.isFinite(n)) return "—";
    var sign = n > 0 ? "+" : "";
    return sign + n.toFixed(1) + "% 24h";
  }

  function itemLabel(key) {
    if (window.RootMcItemKeys && window.RootMcItemKeys.displayName) {
      return window.RootMcItemKeys.displayName(key);
    }
    return String(key || "").replace(/_/g, " ");
  }

  function itemSymbol(key) {
    return String(key || "").toUpperCase();
  }

  function marketItemUrl(key) {
    return "/market/?item=" + encodeURIComponent(String(key || "").toUpperCase());
  }

  async function resolveServerId() {
    try {
      var res = await fetch("/api/rootmc/server/config", { cache: "no-store" });
      var data = await res.json().catch(function () { return {}; });
      var sid = String((data.featured_server || {}).server_id || "").trim();
      if (sid) return sid;
    } catch (_e) { /* fall through */ }
    return SERVER_ID;
  }

  function displayPrice(row) {
    var avg = Number(row.market_avg) || 0;
    var min = Number(row.min_price) || 0;
    return avg > 0 ? avg : min;
  }

  function moversFromItems(items) {
    var map = {};
    (items || []).forEach(function (row) {
      var key = String(row.item_key || "").toUpperCase();
      if (!key) return;
      var pct = Number(row.change_24h_pct);
      map[key] = {
        current: displayPrice(row),
        pct: Number.isFinite(pct) ? pct : 0,
        hasChange: Number.isFinite(pct),
      };
    });
    return map;
  }

  function topTickerRows(items) {
    return (items || [])
      .filter(function (row) {
        return String(row.item_key || "").toUpperCase() && displayPrice(row) > 0;
      })
      .sort(function (a, b) {
        var aCh = Number(a.change_24h_pct);
        var bCh = Number(b.change_24h_pct);
        var aAbs = Number.isFinite(aCh) ? Math.abs(aCh) : -1;
        var bAbs = Number.isFinite(bCh) ? Math.abs(bCh) : -1;
        if (bAbs !== aAbs) return bAbs - aAbs;
        return (Number(b.shop_count) || 0) - (Number(a.shop_count) || 0);
      })
      .slice(0, HERO_COUNT);
  }

  function changePillFromRow(row) {
    var pct = Number(row.change_24h_pct);
    if (!Number.isFinite(pct)) return null;
    if (Math.abs(pct) < 0.05) {
      return { text: "flat", cls: "flat" };
    }
    return {
      text: fmtPct24h(pct),
      cls: pct > 0 ? "up" : "down",
    };
  }

  function stockMeta(stockRow, catalogRow) {
    var qty = stockRow ? Number(stockRow.total_quantity) : NaN;
    var shops = stockRow ? Number(stockRow.shop_count) : Number(catalogRow && catalogRow.sample_count);
    if (Number.isFinite(qty)) {
      if (qty <= 0) return { text: "out of stock", cls: "down" };
      if (qty < 64) return { text: "low stock · " + qty.toLocaleString(), cls: "down" };
      return { text: qty.toLocaleString() + " listed", cls: "up" };
    }
    if (Number.isFinite(shops) && shops > 0) {
      return { text: shops + " shop" + (shops === 1 ? "" : "s"), cls: "up" };
    }
    return { text: "tracked", cls: "flat" };
  }

  function changePill(mover) {
    if (!mover || !mover.hasChange) return null;
    if (Math.abs(mover.pct) < 0.05) {
      return { text: "flat", cls: "flat" };
    }
    return {
      text: fmtPct24h(mover.pct),
      cls: mover.pct > 0 ? "up" : "down",
    };
  }

  function renderHeroTicker(rows, stockByKey) {
    var host = el("home-hero-ticker");
    var meta = el("home-hero-ticker-meta");
    if (!host) return;

    if (!rows.length) {
      host.innerHTML =
        '<p class="rmc-muted rmc-hero-ticker-loading">No shop prices synced yet. Browse <a href="/market/">/market</a> when the server is online.</p>';
      if (meta) meta.textContent = "";
      return;
    }

    host.innerHTML = rows
      .map(function (row) {
        var key = String(row.item_key || "").toUpperCase();
        var price = displayPrice(row);
        var pill = changePillFromRow(row) || stockMeta(stockByKey[key] || row, row);
        return (
          '<div class="rmc-hero-ticker-row">' +
          '<a href="' +
          esc(marketItemUrl(key)) +
          '">' +
          "<strong>" +
          esc(itemSymbol(key)) +
          "</strong>" +
          '<span class="px">' +
          esc(fmtGold(price)) +
          "</span>" +
          '<span class="pill ' +
          esc(pill.cls) +
          '">' +
          esc(pill.text) +
          "</span>" +
          "</a>" +
          "</div>"
        );
      })
      .join("");
  }

  function renderPriceTape(items, movers) {
    var wrap = el("home-price-tape-wrap");
    var host = el("home-price-tape");
    if (!wrap || !host) return;

    var tapeRows = Object.keys(movers)
      .map(function (key) {
        return {
          key: key,
          current: movers[key].current,
          pct: movers[key].pct,
          hasChange: movers[key].hasChange,
        };
      })
      .filter(function (row) {
        return row.hasChange && Math.abs(row.pct) >= 0.05;
      })
      .sort(function (a, b) {
        return Math.abs(b.pct) - Math.abs(a.pct);
      });

    if (tapeRows.length < TAPE_MIN) {
      (items || []).forEach(function (row) {
        var key = String(row.item_key || "").toUpperCase();
        if (!key || tapeRows.some(function (r) { return r.key === key; })) return;
        var mover = movers[key];
        tapeRows.push({
          key: key,
          current: mover ? mover.current : displayPrice(row),
          pct: mover && mover.hasChange ? mover.pct : 0,
          hasChange: mover ? mover.hasChange : false,
        });
      });
    }

    tapeRows = tapeRows.filter(function (row) { return row.current > 0; }).slice(0, 28);
    if (!tapeRows.length) {
      wrap.hidden = true;
      return;
    }

    var segment = tapeRows
      .map(function (row) {
        var dir = !row.hasChange || Math.abs(row.pct) < 0.05 ? "flat" : row.pct > 0 ? "up" : "down";
        return (
          '<a class="rmc-market-tape-item ' +
          dir +
          '" href="' +
          esc(marketItemUrl(row.key)) +
          '">' +
          '<span class="sym">' +
          esc(itemSymbol(row.key)) +
          "</span>" +
          '<span class="px">' +
          esc(fmtGold(row.current)) +
          "</span>" +
          '<span class="chg">' +
          esc(row.hasChange ? fmtPct24h(row.pct) : "—") +
          "</span>" +
          "</a>"
        );
      })
      .join("");

    host.innerHTML =
      '<div class="rmc-market-tape-track">' +
      segment +
      "</div>" +
      '<div class="rmc-market-tape-track" aria-hidden="true">' +
      segment +
      "</div>";
    wrap.hidden = false;
  }

  function renderSyncMeta(syncedAt) {
    var meta = el("home-hero-ticker-meta");
    if (!meta) return;
    var when = syncedAt ? new Date(syncedAt) : null;
    var label = when && !isNaN(when.getTime())
      ? "Synced " + when.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
      : "Live chest-shop median prices";
    meta.innerHTML = label + ' · 24h % change · <a href="/market/">Open /market</a>';
  }

  function showMarketLoadError() {
    var host = el("home-hero-ticker");
    if (!host) return;
    host.innerHTML =
      '<p class="rmc-muted rmc-hero-ticker-loading">Could not load market data. Try <a href="/market/">/market</a>.</p>';
  }

  async function fetchJsonWithTimeout(url, timeoutMs) {
    var controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    var timer = null;
    if (controller) {
      timer = setTimeout(function () { controller.abort(); }, timeoutMs);
    }
    try {
      var res = await fetch(url, { cache: "no-store", signal: controller ? controller.signal : undefined });
      return { ok: res.ok, status: res.status, json: await res.json().catch(function () { return {}; }) };
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  async function loadMarketPreview() {
    var serverId = await resolveServerId();
    try {
      var base =
        "/api/rootmc/stock-market/items?server_id=" + encodeURIComponent(serverId);
      var results = await Promise.all([
        fetchJsonWithTimeout(base + "&per_page=25&sort=shop_count_desc&page=1", 8000),
        fetchJsonWithTimeout(base + "&per_page=25&sort=shop_count_desc&page=2", 8000),
      ]);
      if (!results[0].ok) throw new Error("market HTTP " + results[0].status);

      var items = [];
      results.forEach(function (res) {
        if (res.ok) items = items.concat((res.json.items || []).filter(function (r) { return r.item_key; }));
      });

      var stockByKey = {};
      items.forEach(function (row) {
        stockByKey[String(row.item_key || "").toUpperCase()] = row;
      });

      var movers = moversFromItems(items);
      renderHeroTicker(topTickerRows(items), stockByKey);
      renderPriceTape(items, movers);
      renderSyncMeta(results[0].json.synced_at);
    } catch (_e) {
      showMarketLoadError();
    }
  }

  function scoreLine(p) {
    var votePts = (Number(p.voteCount) || 0) * 5;
    return (
      esc(p.activityScore) +
      " pts (" +
      esc(p.messageCount) +
      " blocks · " +
      esc(p.voteCount) +
      " votes = " +
      esc(votePts) +
      " pts · " +
      esc(p.reactionCount) +
      " reactions)"
    );
  }

  async function loadWeeklyLeaders() {
    var section = document.getElementById("weekly-leaders");
    if (!section) return;

    try {
      var res = await fetch("/api/rootmc/weekly-activity/highlights", { credentials: "same-origin" });
      if (!res.ok) return;
      var data = await res.json();
      if (!data) return;
      var hasCurrentRoleData =
        (Array.isArray(data.currentTopParticipatorRole) && data.currentTopParticipatorRole.length) ||
        (Array.isArray(data.currentTopActivePlayerRole) && data.currentTopActivePlayerRole.length);
      if (!data.posted && !hasCurrentRoleData) return;

      section.hidden = false;

      var weekEl = document.getElementById("weekly-leaders-week");
      if (weekEl && data.weekLabel) {
        weekEl.textContent = "Week of " + data.weekLabel;
      } else if (weekEl && hasCurrentRoleData) {
        weekEl.textContent = "Current Discord role holders";
      }

      var partList = document.getElementById("weekly-participators");
      if (partList && Array.isArray(data.participators) && data.participators.length) {
        partList.innerHTML = data.participators
          .map(function (p) {
            return (
              '<li class="rmc-leader-row">' +
              '<span class="rmc-leader-rank">' +
              esc(p.rank) +
              "</span>" +
              '<span class="rmc-leader-name">' +
              esc(p.displayName) +
              "</span>" +
              '<span class="rmc-leader-meta">' +
              scoreLine(p) +
              "</span>" +
              "</li>"
            );
          })
          .join("");
      } else if (
        partList &&
        Array.isArray(data.currentTopParticipatorRole) &&
        data.currentTopParticipatorRole.length
      ) {
        partList.innerHTML = data.currentTopParticipatorRole
          .map(function (name, idx) {
            return (
              '<li class="rmc-leader-row">' +
              '<span class="rmc-leader-rank">' +
              esc(idx + 1) +
              "</span>" +
              '<span class="rmc-leader-name">' +
              esc(name) +
              "</span>" +
              '<span class="rmc-leader-meta">Current Top Participator role</span>' +
              "</li>"
            );
          })
          .join("");
      } else if (partList) {
        partList.innerHTML = '<li class="rmc-leader-empty">No Top Participator winners this week.</li>';
      }

      var playerBlock = document.getElementById("weekly-top-player");
      if (playerBlock) {
        var topPlayers =
          Array.isArray(data.topActivePlayers) && data.topActivePlayers.length
            ? data.topActivePlayers
            : data.topActivePlayer
              ? [data.topActivePlayer]
              : [];
        if (topPlayers.length) {
          playerBlock.hidden = false;
          playerBlock.innerHTML = topPlayers
            .map(function (tp) {
              var pro = tp.proGranted ? " · Pro member this week" : "";
              return (
                '<p class="rmc-leader-player-name">#' +
                esc(tp.rank || 1) +
                " " +
                esc(tp.minecraftUsername) +
                "</p>" +
                '<p class="rmc-muted">' +
                esc(tp.displayName) +
                " · " +
                esc(tp.weeklyPlaytimeLabel) +
                " in-game" +
                esc(pro) +
                "</p>"
              );
            })
            .join("");
        } else if (Array.isArray(data.currentTopActivePlayerRole) && data.currentTopActivePlayerRole.length) {
          playerBlock.hidden = false;
          playerBlock.innerHTML =
            '<p class="rmc-leader-player-name">' +
            esc(data.currentTopActivePlayerRole[0]) +
            "</p>" +
            '<p class="rmc-muted">Current Top Active Player role holder</p>';
        } else {
          playerBlock.hidden = true;
        }
      }
    } catch (_e) {
      /* keep section hidden until awards exist */
    }
  }

  function boot() {
    loadMarketPreview();
    loadWeeklyLeaders();
    setTimeout(function () {
      var host = el("home-hero-ticker");
      if (!host) return;
      if (host.textContent && host.textContent.toLowerCase().indexOf("loading market") >= 0) {
        showMarketLoadError();
      }
    }, 10000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
