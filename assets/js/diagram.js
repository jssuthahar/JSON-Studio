/*
  diagram.js
  Renders a JSON document as a collapsible, pan/zoomable node-link tree
  using D3. No dependencies beyond D3 (loaded via CDN in tool.html).
*/

(function () {
  const editor = document.getElementById('editor');
  const statusEl = document.getElementById('status');
  const emptyHint = document.getElementById('empty-hint');
  const searchInput = document.getElementById('search-input');
  const searchCount = document.getElementById('search-count');
  const svg = d3.select('#svg');
  const g = d3.select('#canvas-g');

  const SAMPLE = {
    service: "orders-api",
    version: "2.4.1",
    active: true,
    replicas: 3,
    region: null,
    owner: { team: "platform", lead: "S. Jegatheesan", contacts: ["slack:#platform", "on-call:pagerduty"] },
    dependencies: [
      { name: "postgres", type: "database", critical: true },
      { name: "redis", type: "cache", critical: false },
      { name: "auth-service", type: "internal", critical: true }
    ],
    endpoints: ["/orders", "/orders/:id", "/orders/:id/status"]
  };

  let zoomBehavior;
  let currentRoot = null;

  function setStatus(msg, kind) { statusEl.textContent = msg; statusEl.className = kind || ''; }
  function valueClass(v) {
    if (v === null) return 'v-null';
    if (typeof v === 'string') return 'v-str';
    if (typeof v === 'number') return 'v-num';
    if (typeof v === 'boolean') return 'v-bool';
    return '';
  }
  function displayValue(v) {
    if (v === null) return 'null';
    if (typeof v === 'string') return v.length > 28 ? '"' + v.slice(0, 26) + '…"' : '"' + v + '"';
    return String(v);
  }

  function buildTree(key, value) {
    const node = { name: key };
    if (value !== null && typeof value === 'object') {
      const isArr = Array.isArray(value);
      node.kind = isArr ? 'array' : 'object';
      node.meta = isArr ? (value.length + ' items') : (Object.keys(value).length + ' keys');
      const entries = isArr ? value.map((v, i) => [i, v]) : Object.entries(value);
      node.children = entries.map(([k, v]) => buildTree(isArr ? '[' + k + ']' : k, v));
    } else {
      node.kind = 'leaf';
      node.value = value;
    }
    return node;
  }

  function render(json) {
    const treeData = buildTree('root', json);
    currentRoot = d3.hierarchy(treeData, d => d.children);
    currentRoot.x0 = 0; currentRoot.y0 = 0;
    const totalNodes = currentRoot.descendants().length;
    currentRoot.descendants().forEach(d => {
      if (d.depth >= 2 && totalNodes > 40 && d.children) { d._children = d.children; d.children = null; }
    });
    emptyHint.style.display = 'none';
    update(currentRoot);
    fitToScreen();
  }

  const NODE_H = 42, GAP_Y = 16, GAP_X = 264;

  function nodeWidth(d) {
    const label = d.data.name;
    const valStr = d.data.kind === 'leaf' ? displayValue(d.data.value) : '';
    const w = 16 + Math.max(label.length * 7.2, 40) + (valStr ? valStr.length * 7.2 + 14 : 0) + (d.data.kind !== 'leaf' ? 70 : 20);
    return Math.min(Math.max(w, 92), 340);
  }

  function update(source) {
    const treeLayout = d3.tree().nodeSize([NODE_H + GAP_Y, GAP_X]);
    treeLayout(currentRoot);
    const nodes = currentRoot.descendants();
    const links = currentRoot.links();

    const link = g.selectAll('path.link').data(links, d => d.target.data.__id || (d.target.data.__id = Math.random()));
    link.join(
      enter => enter.append('path').attr('class', 'link').attr('d', d3.linkHorizontal().x(d => d.y).y(d => d.x)),
      update => update.attr('d', d3.linkHorizontal().x(d => d.y).y(d => d.x)),
      exit => exit.remove()
    );

    const node = g.selectAll('g.node').data(nodes, d => d.data.__id || (d.data.__id = Math.random()));
    const nodeEnter = node.enter().append('g').attr('class', 'node')
      .attr('transform', d => `translate(${source.y0 || 0},${source.x0 || 0})`);

    nodeEnter.each(function (d) {
      const sel = d3.select(this);
      const w = nodeWidth(d); d._w = w;
      const isRoot = d.depth === 0;
      const kind = d.data.kind;
      const boxClass = kind === 'object' ? 'obj' : (kind === 'array' ? 'arr' : 'leaf');

      sel.append('rect').attr('class', 'node-box ' + boxClass)
        .attr('x', 0).attr('y', -NODE_H / 2).attr('width', w).attr('height', NODE_H).attr('rx', 8);

      if (isRoot) {
        sel.append('text').attr('class', 'root-label').attr('x', 14).attr('y', 4).text('root');
      } else if (kind === 'leaf') {
        sel.append('text').attr('class', 'node-key').attr('x', 14).attr('y', -5).text(d.data.name);
        sel.append('text').attr('class', 'node-val ' + valueClass(d.data.value)).attr('x', 14).attr('y', 14).text(displayValue(d.data.value));
      } else {
        sel.append('text').attr('class', 'node-key').attr('x', 14).attr('y', -5).text(d.data.name);
        sel.append('text').attr('class', 'node-type').attr('x', 14).attr('y', 14).text((kind === 'array' ? 'array · ' : 'object · ') + d.data.meta);
      }

      if (d.data.children && d.data.children.length) {
        const cx = w + 13;
        const tg = sel.append('g').attr('class', 'toggler').style('cursor', 'pointer')
          .on('click', () => { toggle(d); update(d); });
        tg.append('circle').attr('class', 'toggle-circle').attr('cx', cx).attr('cy', 0).attr('r', 10);
        tg.append('text').attr('class', 'toggle-glyph').attr('x', cx).attr('y', 1).text(() => d.children ? '−' : '+');
      }
    });

    const nodeUpdate = nodeEnter.merge(node);
    nodeUpdate.transition().duration(220).attr('transform', d => `translate(${d.y},${d.x})`);
    nodeUpdate.select('.toggle-glyph').text(d => d.children ? '−' : (d.data.children && d.data.children.length ? '+' : ''));
    nodeUpdate.select('.node-box').classed('matched', d => d.data.__matched === true);

    node.exit().transition().duration(180)
      .attr('transform', d => `translate(${source.y},${source.x})`).remove();

    nodes.forEach(d => { d.x0 = d.x; d.y0 = d.y; });
  }

  function toggle(d) {
    if (d.children) { d._children = d.children; d.children = null; }
    else { d.children = d._children; d._children = null; }
  }
  function expandAll(d) {
    if (d._children) { d.children = d._children; d._children = null; }
    if (d.children) d.children.forEach(expandAll);
  }
  function collapseAll(d) {
    if (d.children) { d._children = d.children; d.children.forEach(collapseAll); d.children = null; }
    else if (d._children) { d._children.forEach(collapseAll); }
  }

  function fitToScreen() {
    const bbox = g.node().getBBox();
    const svgEl = document.getElementById('svg');
    const W = svgEl.clientWidth, H = svgEl.clientHeight;
    if (bbox.width === 0 || bbox.height === 0) return;
    const scale = Math.min(W / (bbox.width + 120), H / (bbox.height + 120), 1);
    const tx = (W - bbox.width * scale) / 2 - bbox.x * scale;
    const ty = (H - bbox.height * scale) / 2 - bbox.y * scale;
    svg.transition().duration(300).call(zoomBehavior.transform, d3.zoomIdentity.translate(tx, ty).scale(scale));
  }

  function initZoom() {
    zoomBehavior = d3.zoom().scaleExtent([0.15, 2.5]).on('zoom', (ev) => { g.attr('transform', ev.transform); });
    svg.call(zoomBehavior);
  }
  initZoom();

  function tryParseAndRender() {
    const raw = editor.value.trim();
    if (!raw) { setStatus('Waiting for input.'); return; }
    try {
      const parsed = JSON.parse(raw);
      render(parsed);
      setStatus(`Parsed successfully · ${JSON.stringify(parsed).length} characters`, 'ok');
    } catch (e) { setStatus('Parse error: ' + e.message, 'err'); }
  }

  // A payload can arrive in the URL fragment (shared link, or the browser
  // extension's "send selection here"). Opening such a link while this page is
  // already open changes only the fragment, so listen for that too.
  function takeFromLink() {
    if (!window.JSONStudioLink) return;
    window.JSONStudioLink.readLink().then((text) => {
      if (text) { editor.value = text; tryParseAndRender(); }
    });
  }
  takeFromLink();
  window.addEventListener('hashchange', takeFromLink);

  document.getElementById('btn-render').addEventListener('click', tryParseAndRender);
  document.getElementById('btn-sample').addEventListener('click', () => {
    editor.value = JSON.stringify(SAMPLE, null, 2);
    tryParseAndRender();
  });
  document.getElementById('btn-format').addEventListener('click', () => {
    try { const parsed = JSON.parse(editor.value); editor.value = JSON.stringify(parsed, null, 2); setStatus('Formatted.', 'ok'); }
    catch (e) { setStatus('Cannot format: ' + e.message, 'err'); }
  });
  document.getElementById('btn-upload').addEventListener('click', () => document.getElementById('file-input').click());
  document.getElementById('file-input').addEventListener('change', (ev) => {
    const file = ev.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { editor.value = reader.result; tryParseAndRender(); };
    reader.readAsText(file);
  });
  document.getElementById('btn-expand').addEventListener('click', () => {
    if (!currentRoot) return; expandAll(currentRoot); update(currentRoot); fitToScreen();
  });
  document.getElementById('btn-collapse').addEventListener('click', () => {
    if (!currentRoot) return; currentRoot.children && currentRoot.children.forEach(collapseAll); update(currentRoot); fitToScreen();
  });
  document.getElementById('btn-fit').addEventListener('click', fitToScreen);
  editor.addEventListener('keydown', (e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { tryParseAndRender(); } });

  document.addEventListener('theme-changed', () => {
    // re-render so exported SVG background logic (in export.js) reads the new theme correctly
    if (currentRoot) update(currentRoot);
  });

  function runSearch() {
    const q = searchInput.value.trim().toLowerCase();
    if (!currentRoot) { searchCount.textContent = ''; return; }
    let matches = 0;
    currentRoot.each(d => {
      const hay = (String(d.data.name) + ' ' + (d.data.kind === 'leaf' ? displayValue(d.data.value) : '')).toLowerCase();
      d.data.__matched = q.length > 0 && hay.includes(q);
      if (d.data.__matched) {
        matches++;
        let p = d.parent;
        while (p) { if (p._children) { p.children = p._children; p._children = null; } p = p.parent; }
      }
    });
    searchCount.textContent = q ? matches + ' match' + (matches === 1 ? '' : 'es') : '';
    update(currentRoot);
  }
  searchInput.addEventListener('input', runSearch);

  // Expose for export.js, ai-assist.js and present.js
  window.JSONStudio = window.JSONStudio || {};
  window.JSONStudio.getCurrentRoot = () => currentRoot;
  window.JSONStudio.getEditorValue = () => editor.value;
  window.JSONStudio.svgEl = () => document.getElementById('svg');
  window.JSONStudio.gEl = () => g;

  /* Canvas controls, used by the presenter toolbar. */
  window.JSONStudio.fit = fitToScreen;
  window.JSONStudio.zoomBy = (k) => svg.transition().duration(180).call(zoomBehavior.scaleBy, k);
  window.JSONStudio.panBy = (dx, dy) => svg.transition().duration(180).call(zoomBehavior.translateBy, dx, dy);
  window.JSONStudio.zoomLevel = () => d3.zoomTransform(svg.node()).k;
  window.JSONStudio.hasContent = () => !!currentRoot;

  // Entering or leaving presentation mode resizes the canvas, so re-fit once
  // the layout has settled.
  document.addEventListener('presentation-change', () => {
    if (currentRoot) setTimeout(fitToScreen, 60);
  });
})();
