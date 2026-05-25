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
 *   family_dot       {bool}    -- prepend a coloured dot using d.family
 *   variance_marker  {bool}    -- append " *" if d.variance is truthy
 *
 * Chart configuration:
 *   type        {string}  -- "scatter" | "bar" | "hbar"
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
    if (col.format === 'number') return Number(value).toLocaleString();
    if (col.suffix) return value + col.suffix;
    return String(value);
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
  // Entry point
  // ---------------------------------------------------------------------------

  function init() {
    var config = readJSON('chart-config');
    if (!config) return;

    config.forEach(function (spec) {
      var data = readJSON(spec.data);
      if (!data) return;

      if (spec.table && spec.columns) {
        var tableEl = document.getElementById(spec.table);
        if (tableEl) buildTable(tableEl, data, spec.columns, spec.sort_default, spec.sort_dir);
      }

      if (spec.canvas && spec.chart) {
        var canvas = document.getElementById(spec.canvas);
        if (!canvas) return;
        var type = spec.chart.type;
        if      (type === 'scatter') buildScatterChart(canvas, data, spec.chart);
        else if (type === 'bar')     buildBarChart(canvas, data, spec.chart, false);
        else if (type === 'hbar')    buildBarChart(canvas, data, spec.chart, true);
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
