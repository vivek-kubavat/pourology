/**
 * Pure finance logic shared by Apps Script (as a .gs file) and Node tests.
 * No Sheets / Apps Script APIs in here — only plain data in, plain data out.
 *
 * Conventions:
 *  - Dates are 'YYYY-MM-DD' strings (business timezone: Asia/Kolkata).
 *  - Money is handled internally as integer paise to avoid float drift.
 *  - Partner earnings are DERIVED from recorded sales/expenses, never stored as totals.
 */
var FinanceCore = (function () {
  // ---------- money ----------
  function toPaise(rupees) {
    var n = Number(rupees);
    return isFinite(n) ? Math.round(n * 100) : 0;
  }
  function fromPaise(paise) {
    return Math.round(paise) / 100;
  }

  // ---------- dates ----------
  function parseYmd(ymd) {
    var p = String(ymd).split('-');
    return Date.UTC(+p[0], +p[1] - 1, +p[2]);
  }
  function fmtYmd(ms) {
    var d = new Date(ms);
    var m = d.getUTCMonth() + 1, day = d.getUTCDate();
    return d.getUTCFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (day < 10 ? '0' : '') + day;
  }
  function addDays(ymd, n) {
    return fmtYmd(parseYmd(ymd) + n * 86400000);
  }
  function isYmd(s) {
    return /^\d{4}-\d{2}-\d{2}$/.test(String(s)) && fmtYmd(parseYmd(s)) === String(s);
  }
  function eachDay(from, to, fn) {
    for (var d = from; d <= to; d = addDays(d, 1)) fn(d);
  }

  /**
   * Resolve a period preset to an inclusive {from, to} date range.
   * preset: TODAY | YESTERDAY | WEEK (Mon–today) | MONTH (1st–today) | CUSTOM | ALL
   */
  function periodRange(preset, today, opts) {
    opts = opts || {};
    switch (preset) {
      case 'TODAY': return { from: today, to: today };
      case 'YESTERDAY': var y = addDays(today, -1); return { from: y, to: y };
      case 'WEEK':
        var dow = new Date(parseYmd(today)).getUTCDay(); // 0 = Sun
        return { from: addDays(today, -((dow + 6) % 7)), to: today };
      case 'MONTH': return { from: today.slice(0, 8) + '01', to: today };
      case 'ALL': return { from: opts.startDate || today, to: today };
      case 'CUSTOM':
        if (!isYmd(opts.from) || !isYmd(opts.to)) throw new Error('Custom range needs valid from/to dates.');
        if (opts.from > opts.to) throw new Error('"From" date must be on or before "To" date.');
        return { from: opts.from, to: opts.to };
      default: throw new Error('Unknown period: ' + preset);
    }
  }

  // ---------- P&L ----------
  /**
   * Aggregate recorded transactions into per-day buckets (paise).
   * sales:    [{date, qty, total, total_cogs, status}]
   * expenses: [{date, category, amount, status}]
   * distributableCategories: categories partners agreed count as distributable expenses.
   */
  function dailyPL(sales, expenses, distributableCategories) {
    var allowed = {};
    (distributableCategories || []).forEach(function (c) { allowed[String(c).trim().toLowerCase()] = true; });
    var days = {};
    function bucket(d) {
      return days[d] || (days[d] = { revenue: 0, cogs: 0, expenses: 0, nonDistributableExpenses: 0, cups: 0, orders: 0 });
    }
    (sales || []).forEach(function (s) {
      if (s.status === 'VOID') return;
      var b = bucket(s.date);
      b.revenue += toPaise(s.total);
      b.cogs += toPaise(s.total_cogs);
      b.cups += Number(s.qty) || 0;
      b.orders += 1;
    });
    (expenses || []).forEach(function (e) {
      if (e.status === 'VOID') return;
      var b = bucket(e.date);
      if (allowed[String(e.category).trim().toLowerCase()]) b.expenses += toPaise(e.amount);
      else b.nonDistributableExpenses += toPaise(e.amount);
    });
    return days;
  }

  /** Sum day buckets over an inclusive range. Distributable = revenue − COGS − distributable expenses. */
  function summarize(days, from, to) {
    var t = { revenue: 0, cogs: 0, expenses: 0, nonDistributableExpenses: 0, cups: 0, orders: 0 };
    Object.keys(days).forEach(function (d) {
      if (d < from || d > to) return;
      var b = days[d];
      for (var k in t) t[k] += b[k];
    });
    t.grossProfit = t.revenue - t.cogs;
    t.distributable = t.grossProfit - t.expenses;
    return t;
  }

  // ---------- ownership ----------
  /** Ownership rows in effect on a given date: effective_from <= date <= effective_to (blank = open). */
  function ownershipOn(history, date) {
    return (history || []).filter(function (h) {
      return h.effective_from <= date && (!h.effective_to || h.effective_to >= date);
    }).map(function (h) {
      return { partner_id: h.partner_id, percentage: Number(h.percentage) };
    }).sort(function (a, b) { return a.partner_id < b.partner_id ? -1 : 1; });
  }

  /** Returns an error message, or null when valid. */
  function validateOwnership(rows) {
    if (!rows || !rows.length) return 'At least one partner is required.';
    var total = 0;
    for (var i = 0; i < rows.length; i++) {
      var p = Number(rows[i].percentage);
      if (!isFinite(p) || p < 0 || p > 100) return 'Each ownership must be between 0% and 100%.';
      total += p;
    }
    if (Math.abs(total - 100) > 0.0001) return 'Partner ownership must total 100%.';
    return null;
  }

  /**
   * Plan an ownership change without overwriting history: close the currently open rows the day
   * before `effectiveFrom`, then add new open rows. Returns {close:[{ownership_id, effective_to}], add:[rows]}.
   */
  function planOwnershipChange(history, newRows, effectiveFrom) {
    var err = validateOwnership(newRows);
    if (err) throw new Error(err);
    if (!isYmd(effectiveFrom)) throw new Error('Effective-from must be a valid date.');
    var open = (history || []).filter(function (h) { return !h.effective_to; });
    open.forEach(function (h) {
      if (h.effective_from >= effectiveFrom) {
        throw new Error('Effective-from must be after ' + h.effective_from + ' (the current ownership start date).');
      }
    });
    var dayBefore = addDays(effectiveFrom, -1);
    return {
      close: open.map(function (h) { return { ownership_id: h.ownership_id, effective_to: dayBefore }; }),
      add: newRows.map(function (r) {
        return { partner_id: r.partner_id, percentage: Number(r.percentage), effective_from: effectiveFrom, effective_to: '' };
      })
    };
  }

  // ---------- profit split ----------
  /**
   * Split `paise` across holders by percentage. Rounding remainder goes to the largest holder,
   * so allocations always sum exactly to the amount being distributed.
   */
  function splitAmount(paise, holders) {
    var out = holders.map(function (h) {
      return { partner_id: h.partner_id, percentage: h.percentage, share: Math.round(paise * h.percentage / 100) };
    });
    if (!out.length) return out;
    var diff = paise - out.reduce(function (s, o) { return s + o.share; }, 0);
    if (diff !== 0) {
      var largest = out.reduce(function (a, b) { return b.percentage > a.percentage ? b : a; });
      largest.share += diff;
    }
    return out;
  }

  /**
   * Compute each partner's earned share for [from, to], applying whichever ownership was in effect
   * on each day. Consecutive days with identical ownership form one "segment" (split once per
   * segment, so rounding happens per ownership period rather than per day).
   *
   * Returns {
   *   partners: {partner_id: {earned, segments:[{from,to,profit,percentage,share}]}},
   *   segments: [{from, to, profit, owners}],
   *   unallocated  // profit on days with no ownership record (should be 0 once ownership is set up)
   * }
   */
  function computeShares(days, history, from, to) {
    var segments = [], cur = null, unallocated = 0;
    eachDay(from, to, function (d) {
      var owners = ownershipOn(history, d);
      var key = JSON.stringify(owners);
      var b = days[d];
      var profit = b ? b.revenue - b.cogs - b.expenses : 0;
      if (!owners.length) { unallocated += profit; cur = null; return; }
      if (cur && cur.key === key) { cur.to = d; cur.profit += profit; }
      else { cur = { key: key, from: d, to: d, profit: profit, owners: owners }; segments.push(cur); }
    });
    var partners = {};
    segments.forEach(function (seg) {
      splitAmount(seg.profit, seg.owners).forEach(function (a) {
        var p = partners[a.partner_id] || (partners[a.partner_id] = { earned: 0, segments: [] });
        p.earned += a.share;
        p.segments.push({ from: seg.from, to: seg.to, profit: seg.profit, percentage: a.percentage, share: a.share });
      });
      delete seg.key;
    });
    return { partners: partners, segments: segments, unallocated: unallocated };
  }

  /** Human-readable calculation trace for one partner, e.g. "₹80,000.00 × 20% = ₹16,000.00". */
  function traceLines(partnerResult) {
    return (partnerResult ? partnerResult.segments : []).map(function (s) {
      var range = s.from === s.to ? s.from : s.from + ' → ' + s.to;
      return range + ': ' + inr(s.profit) + ' × ' + s.percentage + '% = ' + inr(s.share);
    });
  }

  // ---------- payments ----------
  function paymentStatus(earnedPaise, paidPaise) {
    if (earnedPaise <= 0) return 'NO_PROFIT';
    if (paidPaise <= 0) return 'PENDING';
    if (paidPaise >= earnedPaise) return 'PAID';
    return 'PARTIALLY_PAID';
  }

  /**
   * Apply a partner's total withdrawals to their earned periods oldest-first (FIFO), so each
   * period in a report gets a paid/remaining/status. Periods with no profit get nothing applied.
   * periods: [{key, earned}] in chronological order. Returns same order with paid/remaining/status,
   * plus `advance` = withdrawals beyond everything earned (paid ahead of profit).
   */
  function allocateWithdrawalsFIFO(periods, totalPaidPaise) {
    var left = totalPaidPaise;
    var rows = periods.map(function (p) {
      var paid = 0;
      if (p.earned > 0 && left > 0) { paid = Math.min(p.earned, left); left -= paid; }
      return { key: p.key, earned: p.earned, paid: paid, remaining: p.earned - paid, status: paymentStatus(p.earned, paid) };
    });
    return { periods: rows, advance: left };
  }

  /** Month buckets 'YYYY-MM' (or day buckets) covering [from, to]. */
  function buckets(from, to, groupBy) {
    var out = [];
    if (groupBy === 'day') { eachDay(from, to, function (d) { out.push({ key: d, from: d, to: d }); }); return out; }
    var d = from;
    while (d <= to) {
      var monthEnd = addDays(addDays(d.slice(0, 8) + '01', 32).slice(0, 8) + '01', -1);
      var end = monthEnd < to ? monthEnd : to;
      out.push({ key: d.slice(0, 7), from: d, to: end });
      d = addDays(end, 1);
    }
    return out;
  }

  // ---------- formatting ----------
  /** Indian-grouped rupees: 150000 → ₹1,50,000.00 */
  function inr(paise) {
    var neg = paise < 0, v = Math.abs(Math.round(paise));
    var rupees = String(Math.floor(v / 100)), dec = String(v % 100);
    if (dec.length < 2) dec = '0' + dec;
    var last3 = rupees.slice(-3), rest = rupees.slice(0, -3);
    var grouped = rest ? rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + last3 : last3;
    return (neg ? '-' : '') + '₹' + grouped + '.' + dec;
  }

  return {
    toPaise: toPaise, fromPaise: fromPaise,
    addDays: addDays, isYmd: isYmd, periodRange: periodRange, buckets: buckets,
    dailyPL: dailyPL, summarize: summarize,
    ownershipOn: ownershipOn, validateOwnership: validateOwnership, planOwnershipChange: planOwnershipChange,
    splitAmount: splitAmount, computeShares: computeShares, traceLines: traceLines,
    paymentStatus: paymentStatus, allocateWithdrawalsFIFO: allocateWithdrawalsFIFO,
    inr: inr
  };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = FinanceCore;
