// Camada de navegador do painel: cliente HTTP, sessao, layout, toast e modal.
// As funcoes puras vivem em helpers.js, que este modulo reexporta em `window`
// para as paginas continuarem usando handlers inline (onclick=).

import {
  STATUS_META, STATUS_ORDER, STATUS_ACTIONS,
  parseJwt, escapeHtml, escapeAttr, formatCents, formatDate, statusBadge,
} from './helpers.js';

// ── API Client ──────────────────────────────────────────────────────────────

// O painel e a API sao servidos pela MESMA origem: o CloudFront tem o bucket S3
// como origem padrao e o API Gateway sob /api/*. Por isso nao ha CORS e nao ha
// URL de API para configurar no build -- basta o prefixo.
//
// Localmente, o nginx do docker-compose.local.yml (no repositorio de
// infraestrutura) replica exatamente esse roteamento.
const API_BASE = '/api';

const LOGIN_PAGE = '/index.html';

const api = {
  getToken: () => localStorage.getItem('token'),
  setToken: (t) => localStorage.setItem('token', t),
  clearToken: () => localStorage.removeItem('token'),

  async request(method, path, body) {
    const opts = { method, headers: {} };
    const token = this.getToken();
    if (token) opts.headers['Authorization'] = `Bearer ${token}`;
    if (body) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
    const resp = await fetch(API_BASE + path, opts);
    if (resp.status === 401) {
      this.clearToken();
      window.location.href = LOGIN_PAGE;
      throw new Error('Unauthorized');
    }
    return resp;
  },

  get(path) { return this.request('GET', path); },
  post(path, body) { return this.request('POST', path, body); },
  put(path, body) { return this.request('PUT', path, body); },
  del(path) { return this.request('DELETE', path); },

  async json(resp) {
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({ error: resp.statusText }));
      throw new Error(err.error || resp.statusText);
    }
    return resp.json();
  },

  async ensureOk(resp) {
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({ error: resp.statusText }));
      throw new Error(err.error || err.message || resp.statusText);
    }
    return resp;
  },
};

// ── Sessao ──────────────────────────────────────────────────────────────────

function requireAuth() {
  if (!api.getToken()) {
    window.location.href = LOGIN_PAGE;
    return false;
  }
  return true;
}

function getUser() {
  const t = api.getToken();
  return t ? parseJwt(t) : null;
}

function logout() {
  api.clearToken();
  window.location.href = LOGIN_PAGE;
}

// ── Layout ──────────────────────────────────────────────────────────────────

const NAV = [
  { href: '/board.html',    label: 'Painel'   },
  { href: '/clientes.html', label: 'Clientes' },
  { href: '/veiculos.html', label: 'Veículos' },
  { href: '/servicos.html', label: 'Serviços' },
  { href: '/insumos.html',  label: 'Insumos'  },
  { href: '/nova-os.html',  label: 'Nova OS'  },
];

function initLayout() {
  if (!requireAuth()) return;
  const user = getUser();
  const cur = window.location.pathname;

  const sidebar = document.getElementById('sidebar');
  if (sidebar) {
    sidebar.innerHTML = `
      <div class="p-5 border-b border-gray-700">
        <h1 class="text-lg font-bold tracking-wide">Oficina</h1>
        <p class="text-xs text-gray-400 mt-1">Sistema de gestão</p>
      </div>
      <nav class="flex-1 p-3 space-y-1">
        ${NAV.map(n => `
          <a href="${n.href}" class="block px-3 py-2 rounded text-sm
            ${cur === n.href ? 'bg-gray-700 text-white font-medium' : 'text-gray-300 hover:bg-gray-800 hover:text-white'}">
            ${n.label}
          </a>`).join('')}
      </nav>`;
  }

  const header = document.getElementById('header');
  if (header) {
    // user e role vem de um JWT que este codigo NAO valida; escapar e
    // obrigatorio antes de injetar no DOM.
    header.innerHTML = `
      <div class="text-sm text-gray-500" id="page-title"></div>
      <div class="flex items-center gap-4">
        <span class="text-sm text-gray-600">${escapeHtml(user?.user || '')} <span class="text-gray-400">(${escapeHtml(user?.role || '')})</span></span>
        <button onclick="logout()" class="text-sm text-red-600 hover:text-red-800 font-medium">Sair</button>
      </div>`;
  }
}

function setPageTitle(t) {
  const el = document.getElementById('page-title');
  if (el) el.textContent = t;
  document.title = 'Oficina - ' + t;
}

// ── Toast ───────────────────────────────────────────────────────────────────

function showToast(msg, type) {
  const el = document.createElement('div');
  el.className = `fixed top-4 right-4 z-50 px-5 py-3 rounded-lg shadow-lg text-white text-sm transition-opacity duration-300
    ${type === 'error' ? 'bg-red-600' : 'bg-green-600'}`;
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 300); }, 3000);
}

function showError(msg) { showToast(msg, 'error'); }

// ── Modal ───────────────────────────────────────────────────────────────────

function openModal(title, bodyHtml) {
  closeModal();
  const overlay = document.createElement('div');
  overlay.id = 'modal-overlay';
  overlay.className = 'fixed inset-0 z-40 bg-black/40 flex items-center justify-center';
  overlay.innerHTML = `
    <div class="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
      <div class="flex items-center justify-between px-6 py-4 border-b">
        <h3 class="text-lg font-semibold">${escapeHtml(title)}</h3>
        <button onclick="closeModal()" class="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
      </div>
      <div class="p-6">${bodyHtml}</div>
    </div>`;
  overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });
  document.body.appendChild(overlay);
}

function closeModal() {
  document.getElementById('modal-overlay')?.remove();
}

// ── Superficie global ───────────────────────────────────────────────────────
//
// As paginas usam handlers inline (onclick="logout()") e blocos <script>
// classicos, que resolvem nomes no escopo global. Como este arquivo e um
// modulo, a publicacao precisa ser explicita.
Object.assign(window, {
  api, requireAuth, getUser, logout,
  NAV, initLayout, setPageTitle,
  showToast, showError, openModal, closeModal,
  STATUS_META, STATUS_ORDER, STATUS_ACTIONS,
  parseJwt, escapeHtml, escapeAttr, formatCents, formatDate, statusBadge,
});

export {
  api, requireAuth, getUser, logout,
  NAV, initLayout, setPageTitle,
  showToast, showError, openModal, closeModal,
  API_BASE, LOGIN_PAGE,
};
