/* ========================================================
   Símbolos de Fé - IPB  |  app.js  (v2)
   Uma página por parágrafo/pergunta
   ======================================================== */

// ── State ──────────────────────────────────────────────
const state = {
  currentDoc: 'confissao',
  pages: [],          // flat list of pages for current doc
  currentPage: 0,
  fontSize: parseInt(localStorage.getItem('fontSize') || '16'),
  nightMode: localStorage.getItem('nightMode') === null ? false : localStorage.getItem('nightMode') === 'true',
  wakeLock: null,
  wakeLockEnabled: false,
};

// ── DOM ────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const contentArea   = $('content-area');
const topbarSub     = $('topbar-sub');
const overlay       = $('overlay');
const sidebar       = $('sidebar');
const indexPanel    = $('index-panel');
const indexList     = $('index-list');
const settingsPanel = $('settings-panel');
const swipeHint     = $('swipe-hint');
const fontDisplay   = $('font-size-display');

// ── Boot ───────────────────────────────────────────────
function boot() {
  applyTheme();
  applyFontSize();
  $('toggle-night').checked = state.nightMode;
  buildPages('confissao');
  renderPage();
  registerSW();
  setTimeout(showSwipeHint, 1200);
}

// ── Service Worker ─────────────────────────────────────
function registerSW() {
  if ('serviceWorker' in navigator)
    navigator.serviceWorker.register('./sw.js').catch(() => {});
}

// ── Build flat pages array ─────────────────────────────
function buildPages(doc) {
  state.currentDoc  = doc;
  state.currentPage = 0;
  state.pages = [];

  if (doc === 'confissao') {
    DATA_CONFISSAO.forEach(cap => {
      (cap.paragrafos || []).forEach(para => {
        state.pages.push({
          type: 'cfw',
          capNum: cap.numero,
          capTitulo: cap.titulo,
          paraNum: para.numero,
          texto: para.texto,
          referencias: para.referencias || null,
        });
      });
    });
  } else if (doc === 'maior') {
    DATA_MAIOR.forEach(q => {
      state.pages.push({ type: 'cat', ...q });
    });
  } else {
    DATA_BREVE.forEach(q => {
      state.pages.push({ type: 'cat', ...q });
    });
  }

  // Update doc selector highlight
  document.querySelectorAll('.doc-item').forEach(el => {
    el.classList.toggle('active', el.dataset.doc === doc);
  });
}

// ── Render ─────────────────────────────────────────────
function renderPage(dir) {
  const page = state.pages[state.currentPage];
  if (!page) return;

  // Topbar subtitle
  if (page.type === 'cfw') {
    topbarSub.textContent = `Cap. ${page.capNum} · §${page.paraNum}`;
  } else {
    const label = state.currentDoc === 'maior' ? 'Cat. Maior' : 'Breve Cat.';
    topbarSub.textContent = `${label} · P${page.numero}`;
  }

  // Content HTML
  let html = '';
  if (page.type === 'cfw') {
    // Convert \n\n in texto to paragraph breaks (for Bible books list in §2)
    const textoHtml = escHtml(page.texto).replace(/\n\n/g, '</p><p class="page-text">').replace(/\n/g, '<br>');
    html = `
      <div class="page-meta">
        <span class="meta-cap">Capítulo ${page.capNum}</span>
        <span class="meta-title">${escHtml(page.capTitulo)}</span>
      </div>
      <div class="page-card">
        <div class="para-label">§ ${page.paraNum}</div>
        <p class="page-text">${textoHtml}</p>
        ${page.referencias ? `<div class="refs">${escHtml(page.referencias)}</div>` : ''}
      </div>`;
  } else {
    html = `
      <div class="page-card qa-card">
        <div class="q-num">P${page.numero}</div>
        <div class="q-label">Pergunta</div>
        <div class="q-text">${escHtml(page.pergunta)}</div>
        <div class="divider"></div>
        <div class="a-label">Resposta</div>
        <div class="a-text">${escHtml(page.resposta)}</div>
        ${page.referencias ? `<div class="refs">${escHtml(page.referencias)}</div>` : ''}
      </div>`;
  }

  contentArea.innerHTML = html;
  contentArea.scrollTop = 0;

  if (dir) {
    contentArea.classList.remove('slide-in-right', 'slide-in-left');
    void contentArea.offsetWidth;
    contentArea.classList.add(dir === 'right' ? 'slide-in-right' : 'slide-in-left');
  }
}

function escHtml(s) {
  if (!s) return '';
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ── Navigation ─────────────────────────────────────────
function navigate(delta) {
  const next = state.currentPage + delta;
  if (next < 0 || next >= state.pages.length) return;
  state.currentPage = next;
  renderPage(delta > 0 ? 'right' : 'left');
}

// ── Left sidebar: Document selector ───────────────────
function openSidebar() {
  overlay.classList.add('open');
  sidebar.classList.add('open');
}

function closeSidebar() {
  overlay.classList.remove('open');
  sidebar.classList.remove('open');
  indexPanel.classList.remove('open');
  settingsPanel.classList.remove('open');

}

// ── Index panel (chapters / questions) ────────────────
function openIndex() {
  indexList.innerHTML = '';

  const pages = state.pages;

  if (state.currentDoc === 'confissao') {
    // Group by chapter
    let lastCap = null;
    pages.forEach((p, idx) => {
      if (p.capNum !== lastCap) {
        lastCap = p.capNum;
        const hdr = document.createElement('div');
        hdr.className = 'index-chapter-hdr';
        hdr.textContent = `Capítulo ${p.capNum} — ${p.capTitulo}`;
        hdr.dataset.idx = idx;
        hdr.addEventListener('click', () => {
          state.currentPage = idx;
          renderPage();
          closeSidebar();
        });
        indexList.appendChild(hdr);
      }
    });
  } else {
    // List every question
    pages.forEach((p, idx) => {
      const div = document.createElement('div');
      div.className = 'index-item' + (idx === state.currentPage ? ' active' : '');
      const preview = p.pergunta.length > 55 ? p.pergunta.substring(0, 55) + '…' : p.pergunta;
      div.innerHTML = `<span class="index-num">P${p.numero}</span><span class="index-text">${escHtml(preview)}</span>`;
      div.addEventListener('click', () => {
        state.currentPage = idx;
        renderPage();
        closeSidebar();
      });
      indexList.appendChild(div);
    });
  }

  // Scroll active into view
  requestAnimationFrame(() => {
    const active = indexList.querySelector('.active');
    if (active) active.scrollIntoView({ block: 'center' });
  });

  overlay.classList.add('open');
  indexPanel.classList.add('open');
}

// ── Settings ───────────────────────────────────────────
function openSettings() {
  overlay.classList.add('open');
  settingsPanel.classList.add('open');
}

// ── Font size ──────────────────────────────────────────
function changeFontSize(delta) {
  state.fontSize = Math.min(26, Math.max(12, state.fontSize + delta));
  localStorage.setItem('fontSize', state.fontSize);
  applyFontSize();
}

function applyFontSize() {
  document.documentElement.style.setProperty('--font-size', state.fontSize + 'px');
  fontDisplay.textContent = state.fontSize + 'px';
}

// ── Night mode ─────────────────────────────────────────
function toggleNightMode(val) {
  state.nightMode = typeof val === 'boolean' ? val : !state.nightMode;
  localStorage.setItem('nightMode', state.nightMode);
  applyTheme();
  $('toggle-night').checked = state.nightMode;
}

function applyTheme() {
  document.body.classList.toggle('night', state.nightMode);
}

// ── Wake Lock ──────────────────────────────────────────
async function toggleWakeLock(enable) {
  state.wakeLockEnabled = enable;
  if (enable) {
    if (!('wakeLock' in navigator)) {
      showToast('Wake Lock não suportado neste navegador/protocolo. Use HTTPS.');
      $('toggle-wake').checked = false;
      state.wakeLockEnabled = false;
      return;
    }
    try {
      state.wakeLock = await navigator.wakeLock.request('screen');
      state.wakeLock.addEventListener('release', () => {
        if (state.wakeLockEnabled) requestWakeLockAgain();
      });
      showToast('Tela permanecerá acesa.');
    } catch(e) {
      showToast('Não foi possível manter tela acesa: ' + e.message);
      $('toggle-wake').checked = false;
      state.wakeLockEnabled = false;
    }
  } else {
    if (state.wakeLock) { await state.wakeLock.release(); state.wakeLock = null; }
  }
}

async function requestWakeLockAgain() {
  try { state.wakeLock = await navigator.wakeLock.request('screen'); } catch(e) {}
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && state.wakeLockEnabled)
    requestWakeLockAgain();
});

// ── Toast notification ─────────────────────────────────
function showToast(msg) {
  let toast = $('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    toast.style.cssText = 'position:fixed;bottom:90px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,.8);color:#fff;padding:10px 18px;border-radius:20px;font-size:13px;z-index:200;white-space:nowrap;max-width:90vw;text-align:center;pointer-events:none;opacity:0;transition:opacity .3s';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.style.opacity = '1';
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => { toast.style.opacity = '0'; }, 3000);
}

// ── Touch swipe ────────────────────────────────────────
let tx = 0, ty = 0;
contentArea.addEventListener('touchstart', e => {
  tx = e.touches[0].clientX; ty = e.touches[0].clientY;
}, { passive: true });
contentArea.addEventListener('touchend', e => {
  const dx = e.changedTouches[0].clientX - tx;
  const dy = e.changedTouches[0].clientY - ty;
  if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 50) navigate(dx < 0 ? 1 : -1);
}, { passive: true });

// ── Keyboard ───────────────────────────────────────────
document.addEventListener('keydown', e => {
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') navigate(1);
  if (e.key === 'ArrowLeft'  || e.key === 'ArrowUp')   navigate(-1);
  if (e.key === 'Escape') { closeSidebar(); closeSearch(); }
});

// ── Swipe hint ─────────────────────────────────────────
function showSwipeHint() {
  if (localStorage.getItem('hintShown')) return;
  swipeHint.classList.add('show');
  setTimeout(() => swipeHint.classList.remove('show'), 2500);
  localStorage.setItem('hintShown', '1');
}

// ── Events ─────────────────────────────────────────────
$('btn-menu').addEventListener('click', openSidebar);
$('btn-index').addEventListener('click', openIndex);
$('btn-settings').addEventListener('click', openSettings);
overlay.addEventListener('click', closeSidebar);

document.querySelectorAll('.doc-item').forEach(el => {
  el.addEventListener('click', () => {
    buildPages(el.dataset.doc);
    renderPage();
    closeSidebar();
  });
});

$('btn-font-minus').addEventListener('click', () => changeFontSize(-2));
$('btn-font-plus').addEventListener('click', () => changeFontSize(2));
$('toggle-night').addEventListener('change', e => toggleNightMode(e.target.checked));
$('toggle-wake').addEventListener('change', e => toggleWakeLock(e.target.checked));

document.addEventListener('DOMContentLoaded', boot);
// ── Search ─────────────────────────────────────────────
const searchOverlay = $('search-overlay');
const searchInput   = $('search-input');
const searchClear   = $('search-clear');
const searchStatus  = $('search-status');
const searchResults = $('search-results');

function openSearch() {
  // Force position via style (bypasses any CSS cache issues)
  const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() || '#F5F5F5';
  searchOverlay.style.display        = 'flex';
  searchOverlay.style.flexDirection  = 'column';
  searchOverlay.style.position       = 'fixed';
  searchOverlay.style.top            = '60px';
  searchOverlay.style.left           = '0';
  searchOverlay.style.right          = '0';
  searchOverlay.style.bottom         = '0';
  searchOverlay.style.zIndex         = '200';
  searchOverlay.style.background     = bg;
  searchInput.value = '';
  searchClear.classList.remove('visible');
  searchStatus.textContent = '';
  searchResults.innerHTML = '';
  setTimeout(() => searchInput.focus(), 50);
}

function closeSearch() {
  searchOverlay.style.cssText = 'display:none';
  searchInput.blur();
}

let searchTimer = null;
searchInput.addEventListener('input', () => {
  const q = searchInput.value;
  searchClear.classList.toggle('visible', q.length > 0);
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => performSearch(q), 250);
});

searchClear.addEventListener('click', () => {
  searchInput.value = '';
  searchClear.classList.remove('visible');
  searchStatus.textContent = '';
  searchResults.innerHTML = '';
  searchInput.focus();
});

function performSearch(query) {
  const q = query.trim();
  if (q.length < 2) {
    searchStatus.textContent = q.length ? 'Digite ao menos 2 caracteres.' : '';
    searchResults.innerHTML = '';
    return;
  }

  const norm = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const qn = norm(q);

  const hits = [];
  state.pages.forEach((p, idx) => {
    const fields = p.type === 'cfw'
      ? [p.texto, p.referencias]
      : [p.pergunta, p.resposta, p.referencias];
    if (fields.filter(Boolean).some(f => norm(f).includes(qn)))
      hits.push({ p, idx });
  });

  searchStatus.textContent = hits.length
    ? `${hits.length} resultado${hits.length !== 1 ? 's' : ''} encontrado${hits.length !== 1 ? 's' : ''}`
    : 'Nenhum resultado encontrado.';

  if (!hits.length) {
    searchResults.innerHTML = `<div class="search-empty">Nenhum resultado para<br><strong>"${escHtml(q)}"</strong></div>`;
    return;
  }

  searchResults.innerHTML = hits.map(({ p, idx }) => {
    const loc = p.type === 'cfw'
      ? `Cap. ${p.capNum}, §${p.paraNum} — ${p.capTitulo}`
      : `P${p.numero}`;
    const fields = p.type === 'cfw'
      ? [p.texto, p.referencias]
      : [p.pergunta, p.resposta, p.referencias];
    const best = fields.find(f => f && norm(f).includes(qn)) || fields[0] || '';
    return `<div class="search-item" data-idx="${idx}">
      <div class="search-item-loc">${escHtml(loc)}</div>
      <div class="search-item-text">${highlight(best, q)}</div>
    </div>`;
  }).join('');

  searchResults.querySelectorAll('.search-item').forEach(el => {
    el.addEventListener('click', () => {
      state.currentPage = parseInt(el.dataset.idx);
      renderPage();
      closeSearch();
    });
  });
}

function highlight(text, query) {
  if (!text) return '';
  const norm = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const qn   = norm(query);
  const tn   = norm(text);
  const i    = tn.indexOf(qn);
  if (i === -1) return escHtml(text.substring(0, 140));
  const start  = Math.max(0, i - 45);
  const end    = Math.min(text.length, i + query.length + 90);
  return (start > 0 ? '…' : '')
    + escHtml(text.substring(start, i))
    + '<mark>' + escHtml(text.substring(i, i + query.length)) + '</mark>'
    + escHtml(text.substring(i + query.length, end))
    + (end < text.length ? '…' : '');
}

$('btn-search').addEventListener('click', openSearch);
$('search-back').addEventListener('click', closeSearch);
