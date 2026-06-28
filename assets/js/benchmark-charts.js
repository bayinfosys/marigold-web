/**
 * benchmark-charts.js
 *
 * Reads a `chart-config` application/json block from the page and wires up
 * sortable tables and Chart.js charts from inline JSON data blocks.
 *
 * Requires Chart.js 4.x to be loaded before this script.
 *
 * Config block format: array of panel specs.
 * Each spec may have:
 *   data         {string}  -- id of application/json block containing the data array
 *   data_url     {string}  -- alternative to `data`: a URL to fetch the data array
 *                              from instead of reading it inline. Use this for large
 *                              per-request datasets where inlining would bloat the
 *                              page; keep `data` for anything small enough to matter
 *                              for crawlability (summaries, tables). Exactly one of
 *                              `data` / `data_url` must be set.
 *   table        {string}  -- id of <table> element to populate (optional)
 *   canvas       {string}  -- id of <canvas> element to render chart into (optional)
 *   columns      {array}   -- column definitions for the table (required if table set)
 *   sort_default {string}  -- key to sort by initially
 *   sort_dir     {string}  -- "asc" or "desc"
 *   chart        {object}  -- chart configuration (required if canvas set)
 *
 * Column definition:
 *   key              {string}  -- data property name
 *   label            {string}  -- header text
 *   format           {string}  -- "number" applies toLocaleString()
 *   suffix           {string}  -- appended to value e.g. "B"
 *   prefix           {string}  -- prepended to value e.g. "£"
 *   family_dot       {bool}    -- prepend a coloured dot using d.family
 *   variance_marker  {bool}    -- append " *" if d.variance is truthy
 *
 * Chart configuration:
 *   type        {string}  -- "scatter" | "bar" | "hbar" | "segmented_line"
 *
 *   scatter:
 *     x, y         {string}  -- data keys for axes
 *     colour_by    {string}  -- data key to colour by (uses FAMILY_COLOURS)
 *     colours      {object}  -- override family colour map {family: hex}
 *     colour_labels {object} -- override family display names
 *     shape_by     {string}  -- data key to change point shape by
 *     shapes       {object}  -- map of value -> Chart.js pointStyle
 *     hollow_if    {string}  -- data key; if truthy, renders hollow circle
 *     legend       {string}  -- id of element to render colour legend into
 *     x_label, y_label, x_min, x_max, y_min, y_max, x_unit, y_unit
 *     label        {string}  -- data key used in tooltip (default: "model")
 *
 *   bar / hbar:
 *     label_key    {string}  -- data key for bar labels
 *     value_key    {string}  -- data key for bar values
 *     colour       {string}  -- hex colour for bars
 *     x_label, y_label, unit
 *
 *   segmented_line:
 *     Renders one line per contiguous run of a key in the data array (e.g.
 *     one line per model, in the order requests were made), with a coloured
 *     background band marking each run's extent on the x axis. Designed for
 *     "value over request index, grouped by which model produced it" --
 *     the shape every per-request benchmark telemetry chart takes.
 *
 *     segment_by   {string}  -- data key that defines a segment (e.g. "model").
 *                               A new segment starts wherever this value changes
 *                               from the previous row.
 *     y            {string}  -- data key for the y value
 *     y_scale      {number}  -- optional multiplier applied to y (e.g. 1e-9 to
 *                               convert bytes to GB). Default 1 (no change).
 *     y_label      {string}  -- y axis label
 *     legend_group {string}  -- id grouping this chart with others that should
 *                               share one legend and one set of toggles. All
 *                               specs sharing a legend_group must use the same
 *                               underlying data (same `data` or `data_url`) so
 *                               segments line up across charts. The legend
 *                               renders into the element named by `legend` on
 *                               whichever spec in the group runs first.
 *     legend       {string}  -- id of element to render the toggle legend into.
 *                               Only needs setting on one spec per legend_group.
 */

(function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // Defaults
  // ---------------------------------------------------------------------------

  var FAMILY_COLOURS = {
    qwen:     '#E24B4A',
    gemma:    '#378ADD',
    llama:    '#1D9E75',
    deepseek: '#7F77DD',
    other:    '#888780'
  };

  var FAMILY_LABELS = {
    qwen:     'Qwen',
    gemma:    'Gemma',
    llama:    'Llama',
    deepseek: 'DeepSeek',
    other:    'Other'
  };

  // Palette for segmented_line charts. Unlike FAMILY_COLOURS (a handful of
  // known model families), a segmented chart can have any number of
  // arbitrary segment values, so colour is assigned deterministically by
  // hashing the segment label rather than from a fixed lookup table -- any
  // new model name gets a colour automatically, with no list to maintain.
  var SEGMENT_PALETTE = [
    '#378ADD', '#1D9E75', '#E0A82E', '#7F77DD', '#E0556B',
    '#3FA7A0', '#C9692B', '#8A6FD1', '#2E9E5B', '#D14C8D',
    '#5B8FD9', '#B8923A', '#4FA3C4', '#9A5FB0'
  ];

  function colourForSegment(label) {
    var h = 0;
    for (var i = 0; i < label.length; i++) {
      h = (h * 31 + label.charCodeAt(i)) >>> 0;
    }
    return SEGMENT_PALETTE[h % SEGMENT_PALETTE.length];
  }

  // ---------------------------------------------------------------------------
  // Theme
  // ---------------------------------------------------------------------------

  var isDark      = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  var gridColour  = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)';
  var labelColour = isDark ? '#aaa' : '#666';
  var tooltipBg   = isDark ? '#2a2a2a' : '#fff';
  var tooltipBorder = isDark ? '#444' : '#ddd';
  var tooltipTitle  = isDark ? '#eee' : '#111';
  var tooltipBody   = isDark ? '#ccc' : '#444';

  // ---------------------------------------------------------------------------
  // Utilities
  // ---------------------------------------------------------------------------

  function readJSON(id) {
    var el = document.getElementById(id);
    if (!el) { console.warn('benchmark-charts: element not found: ' + id); return null; }
    try { return JSON.parse(el.textContent); }
    catch (e) { console.warn('benchmark-charts: JSON parse error in ' + id, e); return null; }
  }

  function hexToRgba(hex, alpha) {
    var r = parseInt(hex.slice(1, 3), 16);
    var g = parseInt(hex.slice(3, 5), 16);
    var b = parseInt(hex.slice(5, 7), 16);
    return 'rgba(' + r + ',' + g + ',' + b + ',' + (alpha != null ? alpha : 1) + ')';
  }

  function formatCell(value, col) {
    if (value == null) return '';
    var out = value;
    if (col.format === 'number') out = Number(value).toLocaleString();
    out = (col.prefix || '') + out + (col.suffix || '');
    return out;
  }

  function baseTooltip() {
    return {
      backgroundColor: tooltipBg,
      borderColor: tooltipBorder,
      borderWidth: 1,
      titleColor: tooltipTitle,
      bodyColor: tooltipBody,
      padding: 10
    };
  }

  function scaleAxis(label, min, max) {
    return {
      grid: { color: gridColour },
      border: { color: gridColour },
      ticks: { color: labelColour, font: { size: 11 } },
      title: {
        display: !!label,
        text: label || '',
        color: labelColour,
        font: { size: 11 }
      },
      min: (min != null) ? min : undefined,
      max: (max != null) ? max : undefined
    };
  }

  // ---------------------------------------------------------------------------
  // Sortable table
  // ---------------------------------------------------------------------------

  function buildTable(tableEl, data, columns, sortDefault, sortDir) {
    var thead = tableEl.querySelector('thead tr');
    var tbody = tableEl.querySelector('tbody');
    if (!thead || !tbody) return;

    // Render headers
    thead.innerHTML = '';
    columns.forEach(function (col) {
      var th = document.createElement('th');
      th.textContent = col.label;
      th.dataset.col  = col.key;
      thead.appendChild(th);
    });

    var currentSort = sortDefault || columns[0].key;
    var currentDir  = (sortDir === 'asc') ? 1 : -1;

    function renderRows(rows) {
      tbody.innerHTML = '';
      rows.forEach(function (d) {
        var tr = document.createElement('tr');
        columns.forEach(function (col) {
          tr.dataset[col.key] = (d[col.key] != null) ? d[col.key] : '';
        });
        columns.forEach(function (col) {
          var td = document.createElement('td');

          if (col.family_dot && d.family) {
            var dot = document.createElement('span');
            dot.className = 'family-dot family-' + d.family;
            td.appendChild(dot);
          }

          var text = formatCell(d[col.key], col);
          if (col.variance_marker && d.variance) text += ' *';
          td.appendChild(document.createTextNode(text));
          tr.appendChild(td);
        });
        tbody.appendChild(tr);
      });
    }

    function sortAndRender() {
      var sorted = data.slice().sort(function (a, b) {
        var av = a[currentSort];
        var bv = b[currentSort];
        var an = parseFloat(av);
        var bn = parseFloat(bv);
        if (!isNaN(an) && !isNaN(bn)) return (an - bn) * currentDir;
        return String(av).localeCompare(String(bv)) * currentDir;
      });
      renderRows(sorted);

      thead.querySelectorAll('th').forEach(function (h) {
        h.classList.remove('sort-asc', 'sort-desc');
      });
      var active = thead.querySelector('th[data-col="' + currentSort + '"]');
      if (active) active.classList.add(currentDir === 1 ? 'sort-asc' : 'sort-desc');
    }

    sortAndRender();

    thead.querySelectorAll('th[data-col]').forEach(function (th) {
      th.title = 'Click to sort';
      th.addEventListener('click', function () {
        if (currentSort === th.dataset.col) {
          currentDir *= -1;
        } else {
          currentSort = th.dataset.col;
          currentDir  = 1;
        }
        sortAndRender();
      });
    });
  }

  // ---------------------------------------------------------------------------
  // Scatter chart
  // ---------------------------------------------------------------------------

  function buildScatterChart(canvas, data, cfg) {
    var labelKey = cfg.label || 'model';

    return new Chart(canvas, {
      type: 'scatter',
      data: {
        datasets: [{
          data: data.map(function(d) {
            var pt = { x: d[cfg.x], y: d[cfg.y] };
            pt[labelKey] = d[labelKey];
            return pt;
          }),
          backgroundColor: cfg.colour || '#378ADD',
          pointRadius: 5,
          pointHoverRadius: 7
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: Object.assign(baseTooltip(), {
            callbacks: {
              label: function(ctx) {
                var d = ctx.raw;
                return ' ' + (d[labelKey] || '') +
                  ': ' + d.y + (cfg.y_unit ? ' ' + cfg.y_unit : '') +
                  ' @ ' + d.x + (cfg.x_unit || '');
              }
            }
          })
        },
        scales: {
          x: scaleAxis(cfg.x_label, cfg.x_min, cfg.x_max),
          y: scaleAxis(cfg.y_label, cfg.y_min, cfg.y_max)
        }
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Bar / horizontal bar chart
  // ---------------------------------------------------------------------------

  function buildBarChart(canvas, data, cfg, horizontal) {
    return new Chart(canvas, {
      type: 'bar',
      data: {
        labels: data.map(function (d) { return d[cfg.label_key]; }),
        datasets: [{
          label: cfg.dataset_label || cfg.value_key,
          data: data.map(function (d) { return d[cfg.value_key]; }),
          backgroundColor: cfg.colour || '#378ADD',
          borderRadius: 3
        }]
      },
      options: {
        indexAxis: horizontal ? 'y' : 'x',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: Object.assign(baseTooltip(), {
            callbacks: {
              label: function (ctx) {
                var v = horizontal ? ctx.parsed.x : ctx.parsed.y;
                return ' ' + v.toLocaleString() + (cfg.unit ? ' ' + cfg.unit : ' ms');
              }
            }
          })
        },
        scales: {
          x: scaleAxis(horizontal ? cfg.x_label : null, null, null),
          y: scaleAxis(horizontal ? null : cfg.y_label, null, null)
        }
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Segmented line chart (one line + background band per contiguous run of
  // segment_by, e.g. one per model across a sequence of per-request rows)
  // ---------------------------------------------------------------------------

  var segmentBandPlugin = {
    id: 'segmentBands',
    beforeDraw: function (chart) {
      var ctx = chart.ctx, chartArea = chart.chartArea, scales = chart.scales;
      chart.data.datasets.forEach(function (ds, i) {
        if (!chart.isDatasetVisible(i)) return;
        var xStart = scales.x.getPixelForValue(ds._segStart);
        var xEnd   = scales.x.getPixelForValue(ds._segEnd);
        ctx.save();
        ctx.fillStyle = ds.borderColor + '1f';
        ctx.fillRect(xStart, chartArea.top, xEnd - xStart, chartArea.bottom - chartArea.top);
        ctx.restore();
      });
    }
  };

  function buildRunSegments(rows, key) {
    var segs = [];
    var cur = null;
    rows.forEach(function (r, i) {
      if (!cur || cur.value !== r[key]) {
        if (cur) segs.push(cur);
        cur = { value: r[key], start: i, end: i };
      } else {
        cur.end = i;
      }
    });
    if (cur) segs.push(cur);
    return segs;
  }

  // Tracks legend_group -> { charts: [Chart...], segments: [...] } so that
  // toggling one chip hides/shows the matching dataset across every chart
  // registered under the same group, even though each chart was built from
  // a separate spec in chart-config.
  var legendGroups = {};

  function buildSegmentedLineChart(canvas, data, cfg) {
    var segments = buildRunSegments(data, cfg.segment_by);
    var scaleFn = cfg.y_scale ? function (v) { return v * cfg.y_scale; } : function (v) { return v; };

    var datasets = segments.map(function (seg) {
      var points = [];
      for (var i = seg.start; i <= seg.end; i++) {
        points.push({ x: i, y: scaleFn(data[i][cfg.y]) });
      }
      var colour = colourForSegment(String(seg.value));
      return {
        label: seg.value, data: points, borderColor: colour,
        backgroundColor: colour, borderWidth: 1.3, pointRadius: 0,
        tension: 0.1, _segStart: seg.start, _segEnd: seg.end
      };
    });

    var chart = new Chart(canvas, {
      type: 'line',
      data: { datasets: datasets },
      options: {
        responsive: true, maintainAspectRatio: false, parsing: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { type: 'linear', grid: { display: false }, ticks: { display: false } },
          y: scaleAxis(cfg.y_label, null, null)
        }
      },
      plugins: [segmentBandPlugin]
    });

    if (cfg.legend_group) {
      var group = legendGroups[cfg.legend_group];
      if (!group) {
        group = legendGroups[cfg.legend_group] = { charts: [], segments: segments };
        if (cfg.legend) renderSegmentLegend(cfg.legend, segments, group);
      }
      group.charts.push(chart);
    }

    return chart;
  }

  function renderSegmentLegend(legendId, segments, group) {
    var el = document.getElementById(legendId);
    if (!el) { console.warn('benchmark-charts: legend element not found: ' + legendId); return; }
    segments.forEach(function (seg, i) {
      var chip = document.createElement('span');
      chip.className = 'seg-chip';
      var colour = colourForSegment(String(seg.value));
      chip.innerHTML = '<span class="dot" style="background:' + colour + ';"></span>' + seg.value;
      chip.addEventListener('click', function () {
        var nowHidden = group.charts[0].isDatasetVisible(i);
        group.charts.forEach(function (c) {
          c.setDatasetVisibility(i, !nowHidden);
          c.update();
        });
        chip.classList.toggle('off', nowHidden);
      });
      el.appendChild(chip);
    });
  }

  // ---------------------------------------------------------------------------
  // Entry point
  // ---------------------------------------------------------------------------

  function renderPanel(spec, data) {
    if (spec.table && spec.columns) {
      var tableEl = document.getElementById(spec.table);
      if (tableEl) buildTable(tableEl, data, spec.columns, spec.sort_default, spec.sort_dir);
    }

    if (spec.canvas && spec.chart) {
      var canvas = document.getElementById(spec.canvas);
      if (!canvas) return;
      var type = spec.chart.type;
      if      (type === 'scatter')        buildScatterChart(canvas, data, spec.chart);
      else if (type === 'bar')            buildBarChart(canvas, data, spec.chart, false);
      else if (type === 'hbar')           buildBarChart(canvas, data, spec.chart, true);
      else if (type === 'segmented_line') buildSegmentedLineChart(canvas, data, spec.chart);
      else console.warn('benchmark-charts: unknown chart type: ' + type);
    }
  }

  function showFetchError(spec) {
    [spec.canvas].concat(
      // segmented_line specs sharing a legend_group may also want the
      // legend itself cleared on failure, but the canvas message is the
      // signal that matters most.
      []
    ).forEach(function (id) {
      var canvas = id && document.getElementById(id);
      if (!canvas) return;
      var note = document.createElement('p');
      note.className = 'chart-caption';
      note.textContent = 'Data failed to load.';
      canvas.replaceWith(note);
    });
  }

  function init() {
    var config = readJSON('chart-config');
    if (!config) return;

    config.forEach(function (spec) {
      if (spec.data_url) {
        fetch(spec.data_url)
          .then(function (response) { return response.json(); })
          .then(function (data) { renderPanel(spec, data); })
          .catch(function (err) {
            console.warn('benchmark-charts: fetch failed for ' + spec.data_url, err);
            showFetchError(spec);
          });
      } else if (spec.data) {
        var data = readJSON(spec.data);
        if (data) renderPanel(spec, data);
      } else {
        console.warn('benchmark-charts: spec has neither data nor data_url', spec);
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
