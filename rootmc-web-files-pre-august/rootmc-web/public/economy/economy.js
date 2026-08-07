(function () {
  var TREASURY = "/api/rootmc/treasury/";
  var SERVER = "/api/rootmc/server/";
  var MARKET_ITEMS = "/api/rootmc/stock-market/items";
  var MARKET_SUMMARY = "/api/rootmc/stock-market";
  var FEATURED_FALLBACK = "rootmc";
  var LB_LIMIT = 8;
  var CHART_GOLD = "#f5b942";
  var CHART_GOLD_FILL = "rgba(245, 185, 66, 0.16)";
  var CHART_HOLDER = "#7eb8da";
  var CHART_HOLDER_FILL = "rgba(126, 184, 218, 0.08)";
  var CHART_GRID = "rgba(255, 255, 255, 0.05)";
  var CHART_TICK = "#a1afa8";

  var TYPE_COLORS = {
    TAX: "#f5b942",
    TOWNY_SINK: "#7eb8da",
    DEATH: "#c97b4a",
    VOTE: "#5dd39e",
    GRANT: "#ef5b5b",
    DIVIDEND: "#ff8f6b",
    LOAN_DISBURSE: "#e06c9f",
    LOAN_PRINCIPAL: "#9b8cff",
    LOAN_INTEREST: "#b8a8ff",
    OPENING: "#d4a853",
  };

  var state = { serverId: "", balanceChart: null };

  function el(id) { return document.getElementById(id); }

  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function fmtGold(n) {
    if (!Number.isFinite(n)) return "\u2014";
    return n.toLocaleString(undefined, { maximumFractionDigits: 2 }) + " G";
  }

  function fmtNum(n) {
    if (!Number.isFinite(n)) return "\u2014";
    return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
  }

  function fmtPct(n) {
    if (!Number.isFinite(n)) return "\u2014";
    var sign = n > 0 ? "+" : "";
    return sign + n.toFixed(1) + "%";
  }

  function fmtWhen(iso) {
    if (!iso) return "";
    try {
      var d = new Date(iso);
      return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
    } catch (_e) {
      return String(iso);
    }
  }

  async function fetchJson(url, timeoutMs) {
    var controller = new AbortController();
    var timer = setTimeout(function () { controller.abort(); }, timeoutMs || 12000);
    try {
      var res = await fetch(url, { cache: "no-store", signal: controller.signal });
      if (!res.ok) throw new Error("HTTP " + res.status);
      return await res.json();
    } finally {
      clearTimeout(timer);
    }
  }

  async function resolveServerId() {
    try {
      var data = await fetchJson("/api/rootmc/server/config", 8000);
      var sid = String((data.featured_server || {}).server_id || "").trim();
      if (sid) return sid;
    } catch (_e) { /* fall through */ }
    return FEATURED_FALLBACK;
  }

  function playerName(row) {
    return String(row.minecraft_username || row.minecraft_uuid || "?").trim() || "?";
  }

  function playerLink(name) {
    if (!name || name === "?") return "?";
    return "<a href=\"/player/?player=" + encodeURIComponent(name) + "\">" + esc(name) + "</a>";
  }

  function netWorthTotal(row) {
    var sum = (Number(row.balance_value) || 0)
      + (Number(row.inventory_value) || 0)
      + (Number(row.chest_value) || 0)
      + (Number(row.shop_stock_value) || 0);
    var stored = Number(row.total_value);
    if (Number.isFinite(stored) && Math.abs(sum - stored) <= 0.01) return stored;
    return sum;
  }

  function typeLabel(type, glossary) {
    var t = String(type || "").trim();
    if (!t) return "—";
    var row = (glossary || []).find(function (g) { return g.type === t; });
    if (row && row.label) {
      return String(row.label).split(" — ")[0].split(" (")[0].trim() || t;
    }
    return t;
  }

  function itemLabel(key) {
    if (window.RootMcItemKeys && window.RootMcItemKeys.displayName) {
      return window.RootMcItemKeys.displayName(key);
    }
    return String(key || "").replace(/_/g, " ");
  }

  function dlRow(label, value, meta) {
    return "<div class=\"economy-dl-row\"><dt>" + esc(label) + "</dt><dd>"
      + value + (meta ? "<span class=\"economy-dl-meta\">" + esc(meta) + "</span>" : "") + "</dd></div>";
  }

  function isNearlyBacked(ns) {
    if (!ns) return false;
    var over = Number(ns.over_issue_g) || 0;
    var backing = Number(ns.backing_pct);
    var debtRetired = Number(ns.debt_retired_pct);
    if (over <= 0.01) return true;
    if (Number.isFinite(backing) && backing >= 98) return true;
    if (over <= 25 && Number.isFinite(debtRetired) && debtRetired >= 90) return true;
    return false;
  }

  function shortfallFactorPct(factor) {
    var f = Number(factor);
    if (!Number.isFinite(f)) f = 0.1;
    return (f * 100).toFixed(0);
  }

  function reserveGrossLedger(reserve) {
    return Number(reserve.balance);
  }

  function renderNoteSupply(reserve) {
    var ns = reserve.note_supply;
    if (!ns) {
      el("eco-note-panel").hidden = true;
      renderHeroFallback(reserve, {}, {});
      return;
    }

    var overIssued = ns.status === "over_issued";
    var overAmt = Number(ns.over_issue_g) || 0;
    var backingPct = Number(ns.backing_pct);
    var nearlyBacked = isNearlyBacked(ns);
    var badge = el("eco-note-badge");
    if (badge) {
      if (!overIssued || overAmt <= 0.01) {
        badge.textContent = "Fully backed · standard tax";
      } else if (nearlyBacked) {
        badge.textContent = (Number.isFinite(backingPct) ? backingPct.toFixed(0) : "99") + "% backed · standard tax";
      } else {
        badge.textContent = "Shortfall · extra tax active";
      }
    }
    el("eco-note-summary").textContent = String(ns.summary || "");
    el("eco-gold-mined").textContent = fmtGold(Number(ns.gold_mined_g));
    var scannedPhysical = Number((reserve.physical_gold_storage_summary || {}).total_storage_g) || 0;
    var combinedCirculating = Number(ns.total_notes_g) + scannedPhysical;
    el("eco-notes-total").textContent = fmtGold(combinedCirculating);
    var overEl = el("eco-over-issue");
    var overLabel = el("eco-over-issue-label");
    if (overLabel) overLabel.textContent = nearlyBacked ? "Shortfall (remaining)" : "Shortfall vs /mint";
    if (overIssued && overAmt > 0.01) {
      overEl.textContent = fmtGold(overAmt);
      overEl.className = "market-summary-value " + (nearlyBacked ? "reserve-in economy-over-issue" : "reserve-out economy-over-issue");
      el("eco-over-issue-meta").textContent = nearlyBacked
        ? "Small gap — standard tax"
        : "More G in circulation than /mint gold";
    } else {
      overEl.textContent = "None";
      overEl.className = "market-summary-value reserve-in";
      el("eco-over-issue-meta").textContent = "Fully covered by /mint gold";
    }
    var backingEl = el("eco-backing-pct");
    if (Number.isFinite(backingPct)) {
      backingEl.textContent = backingPct.toFixed(1) + "%";
      backingEl.classList.toggle("reserve-out", backingPct < 100);
      backingEl.classList.toggle("reserve-in", backingPct >= 100);
    } else {
      backingEl.textContent = "\u2014";
    }

    var dynamicTaxPct = Number(ns.dynamic_tax_pct);
    var shortfallPct = Number(ns.backing_shortfall_pct);
    var shortfallFactor = Number(ns.dynamic_tax_shortfall_factor);
    if (!Number.isFinite(shortfallFactor)) shortfallFactor = 0.1;
    if (!Number.isFinite(dynamicTaxPct) && Number.isFinite(shortfallPct) && overIssued) {
      dynamicTaxPct = shortfallPct * shortfallFactor;
    }
    if (!Number.isFinite(dynamicTaxPct) && Number.isFinite(backingPct) && overIssued) {
      dynamicTaxPct = Math.max(0, 100 - backingPct) * shortfallFactor;
    }
    if (!Number.isFinite(dynamicTaxPct)) {
      dynamicTaxPct = overIssued ? 0 : 0;
    }
    var taxEl = el("eco-dynamic-tax");
    var taxMeta = el("eco-dynamic-tax-meta");
    var taxCell = el("eco-dynamic-tax-cell");
    if (overIssued && dynamicTaxPct > 0.01 && !nearlyBacked) {
      taxEl.textContent = dynamicTaxPct.toFixed(2) + "%";
      taxEl.className = "market-summary-value reserve-out economy-dynamic-tax";
      taxMeta.textContent = "(100% \u2212 " + backingPct.toFixed(1) + "% backed) \u00d7 "
        + shortfallFactorPct(shortfallFactor) + "% \u00b7 extra tax on /pay, shops, /mint";
      if (taxCell) taxCell.classList.add("economy-dynamic-tax--active");
    } else {
      taxEl.textContent = "0.00%";
      taxEl.className = "market-summary-value reserve-in economy-dynamic-tax";
      taxMeta.textContent = nearlyBacked || !overIssued
        ? "Fully backed \u2014 standard 0.1% tax to reserve"
        : "Fully backed \u2014 standard tax";
      if (taxCell) taxCell.classList.remove("economy-dynamic-tax--active");
    }

    var headlineReserve = reserveGrossLedger(reserve);
    if (!Number.isFinite(headlineReserve)) headlineReserve = Number(reserve.balance);
    var circulatingReserve = Number(ns.reserve_notes_g);
    var shortfallRepaid = Number(ns.over_issue_shortfall_repaid_g) || 0;

    el("eco-note-dl").innerHTML = [
      dlRow("Player wallets", fmtGold(Number(ns.player_notes_g)), "spendable G"),
      dlRow("Reserve balance", fmtGold(headlineReserve), "July 1+ ledger"),
      dlRow("Reserve in circulation", fmtGold(circulatingReserve), "counts toward /mint backing"),
      shortfallRepaid > 0.01
        ? dlRow("Over-issue shortfall settled", fmtGold(shortfallRepaid), "one-time ledger repayment")
        : "",
      dlRow("Transaction tax rate", Number.isFinite(dynamicTaxPct)
        ? dynamicTaxPct.toFixed(2) + "%"
        : "0.00%", nearlyBacked || !overIssued
        ? "standard 0.1% when fully backed"
        : "higher until /mint catches up"),
      dlRow("July opening carryover", fmtGold(Number(ns.opening_unbacked_carryover_g)), "unbacked reserve at map merge"),
      dlRow("Physical mined", fmtGold(Number(ns.gold_found_physical_g)), "ore & gold blocks only (not loot/pickups)"),
    ].join("");

    el("eco-note-panel").hidden = false;
    el("eco-note-panel").classList.toggle("economy-note-panel--over", overIssued && !nearlyBacked);

    el("eco-wallet-g").textContent = fmtGold(Number(ns.player_notes_g));
    el("eco-reserve-g").textContent = fmtGold(headlineReserve);
    var reserveMeta = el("eco-reserve-meta");
    if (reserveMeta) {
      var vaultBal = Number(reserve.balance);
      if (Number.isFinite(vaultBal) && Math.abs(vaultBal - headlineReserve) > 0.5) {
        reserveMeta.textContent = "Ledger headline · " + fmtGold(vaultBal) + " in reserve vault";
      } else {
        reserveMeta.textContent = "July opening + post-reset ledger net (after shortfall settlement)";
      }
    }
    el("eco-found-g").textContent = fmtGold(foundHeroAmount(reserve, Number(ns.gold_found_physical_g)));
    setFoundHeroMeta(reserve);
    el("eco-hero").hidden = false;
  }

  function foundHeroAmount(reserve, physicalOverride) {
    var found = reserve && reserve.gold_found_summary ? reserve.gold_found_summary : {};
    var physical = Number(physicalOverride);
    if (!Number.isFinite(physical)) physical = Number(found.physical_mined_since_july_g) || 0;
    var allSources = Number(found.mined_since_july_g);
    if (Number.isFinite(allSources) && allSources > physical + 0.01) return allSources;
    return physical;
  }

  function setFoundHeroMeta(reserve) {
    var meta = el("eco-found-meta");
    if (!meta) return;
    var found = reserve && reserve.gold_found_summary ? reserve.gold_found_summary : {};
    var physical = Number(found.physical_mined_since_july_g);
    var allSources = Number(found.mined_since_july_g);
    if (Number.isFinite(allSources) && allSources > physical + 0.01) {
      meta.textContent = "Ore, loot, mobs, chests — not the same as /mint";
    } else {
      meta.textContent = "Ore & gold blocks since map opening — not loot or /mint";
    }
  }

  function physicalMinedSinceJuly(row) {
    return (Number(row.mined_ore_since_july_g) || 0) + (Number(row.mined_block_since_july_g) || 0);
  }

  function renderHeroFallback(reserve, marketSummary, marketItems) {
    var wallet = Number(reserve.gold_minted_wallet_gold) || 0;
    var reserveBal = Number(reserve.balance) || 0;
    el("eco-wallet-g").textContent = fmtGold(wallet);
    el("eco-reserve-g").textContent = fmtGold(reserveBal);
    var found = reserve.gold_found_summary || {};
    el("eco-found-g").textContent = fmtGold(foundHeroAmount(reserve));
    setFoundHeroMeta(reserve);
    var stacks = Number(marketSummary.total_server_items) || 0;
    if (!stacks && marketItems && marketItems.total) stacks = Number(marketItems.total) || 0;
    el("eco-market-stacks").textContent = fmtNum(stacks) + " stacks";
    el("eco-hero").hidden = false;
  }

  function renderIntegrity(reserve) {
    var box = el("eco-integrity");
    if (!box) return;
    var si = reserve.supply_integrity;
    var ns = reserve.note_supply;
    if (!si) {
      box.hidden = true;
      return;
    }
    if (si.status === "ok") {
      if (ns && isNearlyBacked(ns) && si.summary) {
        box.hidden = false;
        box.className = "economy-alert economy-alert--ok rmc-card";
        box.innerHTML = "<strong>Gold backing</strong> · " + esc(String(si.summary));
        return;
      }
      box.hidden = true;
      return;
    }
    if (ns && isNearlyBacked(ns) && si.status === "reserve_below_opening") {
      box.hidden = false;
      box.className = "economy-alert economy-alert--ok rmc-card";
      box.innerHTML = "<strong>Gold backing</strong> · " + esc(String(si.summary || ""));
      return;
    }
    if (si.status === "ok" && !(ns && ns.status === "over_issued" && !isNearlyBacked(ns))) {
      box.hidden = true;
      return;
    }
    box.hidden = false;
    box.className = "economy-alert rmc-card";
    box.innerHTML = "<strong>Supply check</strong> · " + esc(String(si.summary || "Review reserve vs opening metrics."));
  }

  function renderReservePanel(reserve) {
    var month = reserve.month || {};
    var monthKey = reserve.view_hst_month || reserve.current_hst_month || "";
    el("eco-mtd-in-label").textContent = monthKey ? monthKey + " inflows" : "MTD inflows";
    el("eco-mtd-out-label").textContent = monthKey ? monthKey + " outflows" : "MTD outflows";
    el("eco-mtd-net-label").textContent = monthKey ? monthKey + " net" : "MTD net";
    el("eco-mtd-in").textContent = fmtGold(Number(month.inflow));
    el("eco-mtd-out").textContent = fmtGold(Number(month.outflow));
    el("eco-mtd-net").textContent = fmtGold(Number(month.net));
    renderTypeBars(reserve.type_glossary || [], month.by_type || {});
    renderBalanceChart(reserve.balance_daily || [], reserve.holder_supply_daily || []);
    el("eco-reserve-panel").hidden = false;
  }

  function renderTypeBars(glossary, byType) {
    var host = el("eco-type-bars");
    if (!host) return;
    var entries = Object.keys(byType || {}).map(function (t) {
      return { type: t, amount: Number(byType[t]) || 0 };
    }).filter(function (r) { return r.amount > 0.005; })
      .sort(function (a, b) { return b.amount - a.amount; });
    if (!entries.length) {
      host.innerHTML = "<p class=\"rmc-muted\">No ledger activity this month yet.</p>";
      return;
    }
    var max = entries[0].amount;
    host.innerHTML = entries.map(function (row) {
      var pct = max > 0 ? Math.max(4, (row.amount / max) * 100) : 0;
      var color = TYPE_COLORS[row.type] || "#a1afa8";
      var gRow = glossary.find(function (g) { return g.type === row.type; });
      var dir = gRow && gRow.direction === "outflow" ? "reserve-out" : "reserve-in";
      return "<div class=\"economy-type-row\">"
        + "<span class=\"economy-type-label\">" + esc(typeLabel(row.type, glossary)) + "</span>"
        + "<div class=\"economy-type-bar-track\"><div class=\"economy-type-bar-fill " + dir + "\" style=\"width:" + pct.toFixed(1) + "%;background:" + color + "\"></div></div>"
        + "<span class=\"economy-type-amt " + dir + "\">" + fmtGold(row.amount) + "</span>"
        + "</div>";
    }).join("");
  }

  function renderBalanceChart(daily, holderDaily) {
    var canvas = el("eco-balance-chart");
    if (!canvas || typeof Chart === "undefined") return;
    var rows = (daily || []).slice().sort(function (a, b) {
      return String(a.day || "").localeCompare(String(b.day || ""));
    });
    if (!rows.length) return;
    var holderByDay = {};
    (holderDaily || []).forEach(function (h) {
      if (h && h.day) holderByDay[String(h.day)] = h;
    });
    var labels = rows.map(function (r) { return String(r.day || "").slice(5); });
    var values = rows.map(function (r) { return Number(r.balance) || 0; });
    var holderValues = rows.map(function (r) {
      var h = holderByDay[String(r.day || "")];
      return h ? Number(h.holder_combined_g) || 0 : null;
    });
    var hasHolder = holderValues.some(function (v) { return v != null && v > 0.01; });
    var maxReserve = values.length ? Math.max.apply(null, values) : 0;
    var maxHolder = hasHolder
      ? Math.max.apply(null, holderValues.filter(function (v) { return v != null; }))
      : 0;
    if (maxHolder > maxReserve * 1.15) {
      hasHolder = false;
    }
    if (state.balanceChart) state.balanceChart.destroy();
    var datasets = [{
      label: "Reserve balance",
      data: values,
      borderColor: CHART_GOLD,
      backgroundColor: CHART_GOLD_FILL,
      fill: true,
      tension: 0.25,
      pointRadius: 0,
      borderWidth: 2,
    }];
    if (hasHolder) {
      datasets.push({
        label: "Player wallet Notes (G)",
        data: holderValues,
        borderColor: CHART_HOLDER,
        backgroundColor: CHART_HOLDER_FILL,
        fill: false,
        tension: 0.25,
        pointRadius: 0,
        borderWidth: 2,
        borderDash: [6, 4],
      });
    }
    state.balanceChart = new Chart(canvas, {
      type: "line",
      data: { labels: labels, datasets: datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: hasHolder,
            labels: { color: CHART_TICK, boxWidth: 12 },
          },
        },
        scales: {
          x: { grid: { color: CHART_GRID }, ticks: { color: CHART_TICK, maxTicksLimit: 8 } },
          y: { grid: { color: CHART_GRID }, ticks: { color: CHART_TICK } },
        },
      },
    });
  }

  function goldCell(n) {
    var v = Number(n) || 0;
    return v > 0.01
      ? "<td class=\"lb-gold\">" + fmtGold(v) + "</td>"
      : "<td class=\"rmc-muted\">—</td>";
  }

  function accountKindLabel(kind) {
    if (kind === "reserve") return "Server Reserve";
    if (kind === "town") return "Town bank";
    if (kind === "nation") return "Nation bank";
    return "Player";
  }

  function renderGoldSupplySystemRow(row) {
    return "<tr>"
      + "<td><strong>" + esc(row.display_name || "—") + "</strong></td>"
      + "<td class=\"rmc-muted\">" + esc(accountKindLabel(row.account_kind)) + "</td>"
      + goldCell(row.notes_g)
      + goldCell(row.physical_g)
      + "<td class=\"lb-gold\"><strong>" + fmtGold(Number(row.total_g) || 0) + "</strong></td>"
      + "</tr>";
  }

  function scanDetailLabel(row) {
    var parts = [];
    if (Number(row.inventory_g) > 0.01) parts.push("inv " + fmtGold(row.inventory_g));
    if (Number(row.ender_g) > 0.01) parts.push("ender " + fmtGold(row.ender_g));
    if (Number(row.shop_g) > 0.01) parts.push("shop " + fmtGold(row.shop_g));
    if (Number(row.chest_g) > 0.01) parts.push("chest " + fmtGold(row.chest_g));
    if (Number(row.towny_placed_g) > 0.01) parts.push("towny " + fmtGold(row.towny_placed_g));
    return parts.length ? parts.join(" · ") : "—";
  }

  function renderGoldSupplyPlayerRow(row) {
    var receipts = Number(row.item_events) > 0
      ? row.item_events.toLocaleString() + " (" + fmtGold(Number(row.item_events_g)) + ")"
      : "—";
    return "<tr>"
      + "<td>" + playerLink(row.display_name || row.minecraft_username || "—") + "</td>"
      + goldCell(row.notes_g)
      + goldCell(row.physical_g)
      + goldCell(row.found_physical_g)
      + goldCell(row.found_loot_g)
      + "<td class=\"rmc-muted\">" + esc(receipts) + "</td>"
      + "<td class=\"rmc-muted economy-scan-detail\">" + esc(scanDetailLabel(row)) + "</td>"
      + "</tr>";
  }

  function renderGoldSupplyRow(row, includePlayerCols) {
    return includePlayerCols ? renderGoldSupplyPlayerRow(row) : renderGoldSupplySystemRow(row);
  }

  function renderGoldSupply(report) {
    if (!report) return;
    var panel = el("gold-supply");
    if (!panel) return;
    var totals = report.totals || {};
    var meta = report.scan_meta || {};
    var hero = el("eco-gold-supply-hero");
    if (hero) {
      hero.innerHTML = [
        "<div class=\"market-summary-cell\"><div class=\"market-summary-label\">Wallet Notes</div>"
          + "<div class=\"market-summary-value\">" + fmtGold(Number(totals.notes_g)) + "</div></div>",
        "<div class=\"market-summary-cell\"><div class=\"market-summary-label\">Scanned physical</div>"
          + "<div class=\"market-summary-value reserve-in\">" + fmtGold(Number(totals.physical_g)) + "</div>"
          + "<p class=\"market-summary-meta\">online inv/ender + shops + " + (meta.chunks_scanned || 0) + " chunks/scan</p></div>",
        "<div class=\"market-summary-cell\"><div class=\"market-summary-label\">Mined (tracker)</div>"
          + "<div class=\"market-summary-value\">" + fmtGold(Number(totals.found_physical_g)) + "</div>"
          + "<p class=\"market-summary-meta\">ore &amp; blocks since July</p></div>",
        "<div class=\"market-summary-cell\"><div class=\"market-summary-label\">Item receipts</div>"
          + "<div class=\"market-summary-value\">" + (Number(totals.item_events) || 0).toLocaleString() + "</div>"
          + "<p class=\"market-summary-meta\">per-stack events synced</p></div>",
      ].join("");
    }
    var systemRows = report.system_accounts || [];
    el("eco-gold-supply-system-body").innerHTML = systemRows.length
      ? systemRows.map(function (row) { return renderGoldSupplySystemRow(row); }).join("")
      : "<tr><td colspan=\"5\" class=\"rmc-muted\">No server accounts synced yet.</td></tr>";
    var playerRows = (report.players || []).slice().sort(function (a, b) {
      var aReceiptGold = Number(a.item_events_g) || 0;
      var bReceiptGold = Number(b.item_events_g) || 0;
      if (Math.abs(bReceiptGold - aReceiptGold) > 0.0001) return bReceiptGold - aReceiptGold;
      var aReceiptCount = Number(a.item_events) || 0;
      var bReceiptCount = Number(b.item_events) || 0;
      if (bReceiptCount !== aReceiptCount) return bReceiptCount - aReceiptCount;
      var aMined = Number(a.found_physical_g) || 0;
      var bMined = Number(b.found_physical_g) || 0;
      if (Math.abs(bMined - aMined) > 0.0001) return bMined - aMined;
      var aNotes = Number(a.notes_g) || 0;
      var bNotes = Number(b.notes_g) || 0;
      return bNotes - aNotes;
    });
    el("eco-gold-supply-players-body").innerHTML = playerRows.length
      ? playerRows.map(function (row) { return renderGoldSupplyPlayerRow(row); }).join("")
      : "<tr><td colspan=\"7\" class=\"rmc-muted\">No player gold data yet.</td></tr>";
    var foot = el("eco-gold-supply-footnote");
    if (foot) {
      foot.textContent = "Scanned physical = redeemable items found on the last server scan (online players only; "
        + (meta.chunks_scanned || 0) + " loaded chunks and " + (meta.shops_scanned || 0)
        + " shops per 30 min). Mined/Loot = activity counters, not proof of items held. "
        + "Item receipts = per-stack log from Root-Essentials. Last scan: "
        + (report.physical_scanned_at ? fmtWhen(report.physical_scanned_at) : "pending") + ".";
    }
    var scanNote = el("eco-gold-supply-scan-note");
    if (scanNote) {
      scanNote.hidden = false;
      scanNote.textContent = "Players are sorted by receipt-backed gold first (then receipt count), while physical scan only sees online players plus rotating loaded chunks.";
    }
    var metaEl = el("eco-gold-supply-meta");
    if (metaEl && report.synced_at) {
      metaEl.textContent = "Balances synced " + fmtWhen(report.synced_at)
        + ". Notes = wallet G. Scanned physical = last server scan only (partial). Mined/Loot = activity trackers since July.";
    }
    panel.hidden = false;
  }

  function renderSupplyPanel(reserve) {
    var ns = reserve.note_supply || {};
    var found = reserve.gold_found_summary || {};
    var allTime = reserve.all_time || {};
    el("eco-supply-dl").innerHTML = [
      dlRow("Backed by /mint", fmtGold(Number(ns.gold_mined_g ?? reserve.gold_minted_post_reset_ledger)), "gold converted to wallet G"),
      dlRow("Backing total", fmtGold(Number(ns.backing_g)), "/mint since July 1"),
      dlRow("Gold in circulation", fmtGold(Number(ns.total_notes_g))),
      dlRow("Shortfall vs /mint", ns.over_issue_g > 0.01 ? fmtGold(Number(ns.over_issue_g)) : "None"),
      dlRow("Backing ratio", Number.isFinite(Number(ns.backing_pct)) ? Number(ns.backing_pct).toFixed(1) + "%" : "—"),
      dlRow("Post-reset ledger net", fmtGold(Number(reserve.map_262_post_reset_ledger_net))),
      dlRow("Loan repayments (minted)", fmtGold(Number(reserve.gold_minted_loan_repayments_all_time))),
      dlRow("Reserve inflows (since July 1)", fmtGold(Number(allTime.inflow))),
      dlRow("Reserve outflows (since July 1)", fmtGold(Number(allTime.outflow))),
    ].join("");
    el("eco-map-dl").innerHTML = "";
    el("eco-supply-panel").hidden = false;
  }

  function renderTownyPanel(reserve) {
    var towny = reserve.towny_intake_mtd || {};
    el("eco-towny-dl").innerHTML = [
      dlRow("New towns", fmtGold(Number(towny.new_town))),
      dlRow("New nations", fmtGold(Number(towny.new_nation))),
      dlRow("Claims & outposts", fmtGold(Number(towny.claims))),
      dlRow("Service fees", fmtGold(Number(towny.service_fees))),
      dlRow("Other Towny", fmtGold(Number(towny.other))),
      dlRow("Total MTD intake", fmtGold(Number(towny.total)), "to Reserve ledger"),
    ].join("");
    el("eco-towny-panel").hidden = false;
  }

  function renderMarketPanel(itemsPage, marketSummary) {
    var items = (itemsPage.items || []).slice();
    items.sort(function (a, b) {
      var pa = Number(a.change_24h_pct);
      var pb = Number(b.change_24h_pct);
      if (!Number.isFinite(pa) && !Number.isFinite(pb)) return 0;
      if (!Number.isFinite(pa)) return 1;
      if (!Number.isFinite(pb)) return -1;
      return Math.abs(pb) - Math.abs(pa);
    });
    var top = items.filter(function (r) {
      return Number.isFinite(Number(r.change_24h_pct)) && displayPrice(r) > 0;
    }).slice(0, 8);
    var totalItems = Number(itemsPage.total) || items.length;
    el("eco-market-meta").textContent = fmtNum(Number(marketSummary.total_server_items) || 0)
      + " item stacks in shops · " + fmtNum(totalItems) + " distinct listings tracked";
    var tbody = el("eco-movers").querySelector("tbody");
    if (!top.length) {
      tbody.innerHTML = "<tr><td colspan=\"4\" class=\"rmc-muted\">No 24h price movers yet.</td></tr>";
    } else {
      tbody.innerHTML = top.map(function (row) {
        var key = String(row.item_key || "").toUpperCase();
        var pct = Number(row.change_24h_pct);
        var cls = pct >= 0 ? "reserve-in" : "reserve-out";
        return "<tr><td><a href=\"/market/?item=" + encodeURIComponent(key) + "\">" + esc(itemLabel(key)) + "</a></td>"
          + "<td class=\"lb-gold\">" + fmtGold(displayPrice(row)) + "</td>"
          + "<td class=\"" + cls + "\">" + fmtPct(pct) + "</td>"
          + "<td>" + fmtNum(Number(row.shop_count) || 0) + "</td></tr>";
      }).join("");
    }
    el("eco-market-panel").hidden = false;
  }

  function displayPrice(row) {
    var avg = Number(row.market_avg) || 0;
    var min = Number(row.min_price) || 0;
    return avg > 0 ? avg : min;
  }

  function renderLeaderboards(netWorth, mint, goldFound) {
    var nwRows = (netWorth.leaderboard || []).slice(0, LB_LIMIT);
    el("eco-lb-nw-body").innerHTML = nwRows.map(function (row, i) {
      return "<tr><td>" + (row.rank || i + 1) + "</td><td>" + playerLink(playerName(row))
        + "</td><td class=\"lb-gold\">" + fmtGold(netWorthTotal(row)) + "</td></tr>";
    }).join("") || "<tr><td colspan=\"3\" class=\"rmc-muted\">No data yet.</td></tr>";
    el("eco-lb-networth").hidden = false;

    var mintRows = (mint.leaderboard || []).slice(0, LB_LIMIT);
    el("eco-mint-meta").textContent = "Total via /mint: " + fmtGold(Number(mint.total_gross_minted_g))
      + " · " + mintRows.length + "+ players · physical → wallet Notes (G)";
    el("eco-lb-mint-body").innerHTML = mintRows.map(function (row) {
      return "<tr><td>" + row.rank + "</td><td>" + playerLink(playerName(row))
        + "</td><td class=\"lb-gold\">" + fmtGold(Number(row.gross_minted_g)) + "</td></tr>";
    }).join("") || "<tr><td colspan=\"3\" class=\"rmc-muted\">No /mint conversions yet.</td></tr>";
    el("eco-lb-mint").hidden = false;

    var foundRows = (goldFound.leaderboard || []).slice(0, LB_LIMIT);
    var foundSummary = (goldFound.summary) || {};
    var panelMeta = el("eco-found-panel-meta");
    if (panelMeta) {
      var physTotal = Number(foundSummary.physical_mined_since_july_g);
      var allTotal = Number(foundSummary.mined_since_july_g);
      panelMeta.textContent = "Physical mined ranks ore/blocks; all sources adds loot, mob drops & pickups."
        + (Number.isFinite(allTotal) && allTotal > 0.01
          ? " Realm totals: " + fmtGold(physTotal) + " mined · " + fmtGold(allTotal) + " all sources."
          : "");
    }
    el("eco-lb-found-body").innerHTML = foundRows.map(function (row, i) {
      var physical = physicalMinedSinceJuly(row);
      var allSources = Number(row.mined_since_july_g);
      return "<tr><td>" + (row.rank || i + 1) + "</td><td>" + playerLink(playerName(row))
        + "</td><td class=\"lb-gold\">" + fmtGold(physical)
        + "</td><td class=\"lb-gold\">" + fmtGold(allSources) + "</td></tr>";
    }).join("") || "<tr><td colspan=\"4\" class=\"rmc-muted\">No gold-found data yet.</td></tr>";
    el("eco-lb-found").hidden = false;
  }

  function renderLeaderboardsWithReserve(reserve, netWorth, mint, goldFound) {
    if ((!goldFound.leaderboard || !goldFound.leaderboard.length) && reserve.gold_found_leaderboard_since_july) {
      goldFound = { leaderboard: reserve.gold_found_leaderboard_since_july };
    }
    renderLeaderboards(netWorth, mint, goldFound);
  }

  function showError(msg) {
    var box = el("eco-error");
    box.textContent = msg;
    box.hidden = false;
  }

  async function load() {
    try {
      state.serverId = await resolveServerId();
      var sid = encodeURIComponent(state.serverId);
      var treasurySid = "rootmc";
      var results = await Promise.all([
        fetchJson(TREASURY + encodeURIComponent(treasurySid) + "/reserve", 15000),
        fetchJson(MARKET_SUMMARY + "?server_id=" + sid, 12000).catch(function () { return {}; }),
        fetchJson(MARKET_ITEMS + "?server_id=" + sid + "&per_page=40&sort=quantity_desc&in_stock=1", 12000).catch(function () { return { items: [] }; }),
        fetchJson(SERVER + sid + "/economy/net-worth?limit=" + LB_LIMIT, 12000).catch(function () { return { leaderboard: [] }; }),
        fetchJson(TREASURY + encodeURIComponent(treasurySid) + "/mint/leaderboard?limit=" + LB_LIMIT, 12000).catch(function () { return { leaderboard: [] }; }),
        fetchJson(SERVER + sid + "/gold-found/leaderboard?limit=" + LB_LIMIT + "&order=since_july", 12000).catch(function () { return { leaderboard: [] }; }),
        fetchJson(SERVER + sid + "/economy/gold-supply?limit=200", 15000).catch(function () { return null; }),
      ]);
      var reserve = results[0];
      var marketSummary = results[1];
      var marketItems = results[2];
      var netWorth = results[3];
      var mint = results[4];
      var goldFound = results[5];
      var goldSupply = results[6];

      if (marketItems && marketSummary) {
        var stacks = Number(marketSummary.total_server_items) || 0;
        if (!stacks && marketItems.total) stacks = Number(marketItems.total) || 0;
        if (el("eco-market-stacks")) el("eco-market-stacks").textContent = fmtNum(stacks) + " stacks";
      }

      var synced = reserve.synced_at || marketSummary.synced_at || null;
      var monthKey = reserve.view_hst_month || reserve.current_hst_month || "";
      el("eco-subtitle").textContent = synced
        ? "Last synced " + fmtWhen(synced) + (monthKey ? " · viewing " + monthKey + " (HST)" : "")
        : "Combined view of wallets, reserve, market, and leaderboards";
      el("eco-quicklinks").hidden = false;

      renderNoteSupply(reserve);
      renderIntegrity(reserve);
      renderSupplyPanel(reserve);
      renderMarketPanel(marketItems, marketSummary);
      renderLeaderboardsWithReserve(reserve, netWorth, mint, goldFound);
      renderGoldSupply(goldSupply);
    } catch (err) {
      showError("Could not load economy data. " + (err && err.message ? err.message : "Try again shortly."));
      el("eco-subtitle").textContent = "Economy overview unavailable";
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", load);
  } else {
    load();
  }
})();
