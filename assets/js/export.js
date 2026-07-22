/*
  export.js
  Exports the current diagram as a standalone SVG or a rasterized PNG.
  Depends on window.JSONStudio (set up in diagram.js).
*/

(function () {
  function serializeSVG() {
    const svgEl = window.JSONStudio.svgEl();
    const g = window.JSONStudio.gEl();
    const clone = svgEl.cloneNode(true);
    const bbox = g.node().getBBox();
    const pad = 40;
    clone.setAttribute('width', bbox.width + pad * 2);
    clone.setAttribute('height', bbox.height + pad * 2);
    clone.setAttribute('viewBox', `${bbox.x - pad} ${bbox.y - pad} ${bbox.width + pad * 2} ${bbox.height + pad * 2}`);
    clone.querySelector('#canvas-g').removeAttribute('transform');

    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const bg = isDark ? '#12151c' : '#f5f6f8';
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', bbox.x - pad); rect.setAttribute('y', bbox.y - pad);
    rect.setAttribute('width', bbox.width + pad * 2); rect.setAttribute('height', bbox.height + pad * 2);
    rect.setAttribute('fill', bg);
    clone.querySelector('#canvas-g').insertBefore(rect, clone.querySelector('#canvas-g').firstChild);

    // inline the relevant style rules so the exported file is self-contained
    const styleText = Array.from(document.styleSheets)
      .map(s => { try { return Array.from(s.cssRules).map(r => r.cssText).join('\n'); } catch (e) { return ''; } })
      .join('\n');
    const styleEl = document.createElementNS('http://www.w3.org/2000/svg', 'style');
    styleEl.textContent = styleText;
    clone.insertBefore(styleEl, clone.firstChild);

    const serializer = new XMLSerializer();
    return { svgString: serializer.serializeToString(clone), width: bbox.width + pad * 2, height: bbox.height + pad * 2 };
  }

  function downloadBlob(content, filename, type) {
    const blob = content instanceof Blob ? content : new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  }

  document.getElementById('btn-export-svg').addEventListener('click', () => {
    if (!window.JSONStudio.getCurrentRoot()) { return; }
    const { svgString } = serializeSVG();
    downloadBlob(svgString, 'json-diagram.svg', 'image/svg+xml');
  });

  document.getElementById('btn-export-png').addEventListener('click', () => {
    if (!window.JSONStudio.getCurrentRoot()) { return; }
    const { svgString, width, height } = serializeSVG();
    const img = new Image();
    const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    img.onload = () => {
      const scale = 2;
      const canvas = document.createElement('canvas');
      canvas.width = width * scale; canvas.height = height * scale;
      const ctx = canvas.getContext('2d');
      ctx.scale(scale, scale);
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      canvas.toBlob(blob => downloadBlob(blob, 'json-diagram.png', 'image/png'));
    };
    img.src = url;
  });
})();
