// Funcoes puras do painel: sem DOM, sem rede, sem estado global.
//
// Vivem separadas de app.js justamente para serem testaveis em isolamento --
// em especial escapeHtml/escapeAttr, que sao a unica defesa contra XSS de todo
// o painel (cada innerHTML das paginas passa por elas).

export const STATUS_META = {
  RECEBIDA:             { label: 'Recebida',             bg: 'bg-blue-100',    text: 'text-blue-800'    },
  EM_DIAGNOSTICO:       { label: 'Em diagnóstico',       bg: 'bg-yellow-100',  text: 'text-yellow-800'  },
  AGUARDANDO_APROVACAO: { label: 'Aguardando aprovação', bg: 'bg-orange-100',  text: 'text-orange-800'  },
  AGUARDANDO_PAGAMENTO: { label: 'Aguardando pagamento', bg: 'bg-indigo-100',  text: 'text-indigo-800'  },
  APROVADO:             { label: 'Aprovado',             bg: 'bg-green-100',   text: 'text-green-800'   },
  EM_EXECUCAO:          { label: 'Em execução',          bg: 'bg-purple-100',  text: 'text-purple-800'  },
  FINALIZADA:           { label: 'Finalizada',           bg: 'bg-teal-100',    text: 'text-teal-800'    },
  ENTREGUE:             { label: 'Entregue',             bg: 'bg-emerald-100', text: 'text-emerald-800' },
  CANCELADA:            { label: 'Cancelada',            bg: 'bg-red-100',     text: 'text-red-800'     },
};

export const STATUS_ORDER = [
  'RECEBIDA', 'EM_DIAGNOSTICO', 'AGUARDANDO_APROVACAO', 'AGUARDANDO_PAGAMENTO',
  'APROVADO', 'EM_EXECUCAO', 'FINALIZADA', 'ENTREGUE',
];

/**
 * Le o payload de um JWT sem validar a assinatura. Serve apenas para exibir
 * nome e papel do usuario logado -- toda decisao de autorizacao acontece no
 * servidor, que verifica a assinatura de verdade.
 * Devolve null para qualquer token malformado, em vez de lancar.
 */
export function parseJwt(token) {
  try {
    const b = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(b));
  } catch {
    return null;
  }
}

/** Escapa texto para interpolacao segura em innerHTML. */
export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Escapa texto para interpolacao dentro de um atributo HTML. */
export function escapeAttr(value) {
  return escapeHtml(value);
}

/** Formata centavos inteiros como moeda brasileira. */
export function formatCents(c) {
  return 'R$ ' + (c / 100).toFixed(2).replace('.', ',');
}

/** Formata uma data ISO para pt-BR; string vazia quando nao ha data. */
export function formatDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

/**
 * Badge de status. Status desconhecido nao quebra a tela: cai num rotulo
 * neutro exibindo o proprio valor -- e o valor passa por escapeHtml, porque
 * vem da API.
 */
export function statusBadge(status) {
  const m = STATUS_META[status] || { label: status, bg: 'bg-gray-100', text: 'text-gray-800' };
  return `<span class="inline-block px-2 py-1 text-xs font-semibold rounded-full ${m.bg} ${m.text}">${escapeHtml(m.label)}</span>`;
}

const NEUTRAL = 'bg-gray-100 text-gray-700';

export const TICKET_STATUS_META = {
  DIAGNOSTICO_NA_FILA: { label: 'Na fila de diagnóstico', cls: 'bg-blue-100 text-blue-800' },
  EM_DIAGNOSTICO:      { label: 'Em diagnóstico',         cls: 'bg-yellow-100 text-yellow-800' },
  DIAGNOSTICADO:       { label: 'Diagnosticado',          cls: 'bg-orange-100 text-orange-800' },
  REPARO_NA_FILA:      { label: 'Na fila de reparo',      cls: 'bg-indigo-100 text-indigo-800' },
  EM_REPARO:           { label: 'Em reparo',              cls: 'bg-purple-100 text-purple-800' },
  CONCLUIDO:           { label: 'Concluído',              cls: 'bg-teal-100 text-teal-800' },
  CANCELADO:           { label: 'Cancelado',              cls: 'bg-red-100 text-red-800' },
};

export const ITEM_STATUS_META = {
  PENDENTE:             { label: 'Pendente',             cls: 'bg-gray-100 text-gray-600' },
  AGUARDANDO_APROVACAO: { label: 'Aguardando aprovação', cls: 'bg-orange-100 text-orange-700' },
  EM_EXECUCAO:          { label: 'Em execução',          cls: 'bg-purple-100 text-purple-700' },
  FINALIZADO:           { label: 'Finalizado',           cls: 'bg-green-100 text-green-700' },
};

export const DECISION_META = {
  PENDENTE:  { label: 'Pendente',  cls: 'bg-gray-100 text-gray-600' },
  APROVADO:  { label: 'Aprovado',  cls: 'bg-green-100 text-green-700' },
  REPROVADO: { label: 'Reprovado', cls: 'bg-red-100 text-red-700' },
};

export const QUOTE_STATUS_META = {
  ENVIADO:   { label: 'Enviado ao cliente', cls: 'bg-orange-100 text-orange-800' },
  APROVADO:  { label: 'Aprovado',           cls: 'bg-green-100 text-green-800' },
  REPROVADO: { label: 'Reprovado',          cls: 'bg-red-100 text-red-800' },
  CANCELADO: { label: 'Cancelado',          cls: 'bg-gray-200 text-gray-700' },
};

export const PAYMENT_STATUS_META = {
  PENDENTE:  { label: 'Pendente',  cls: 'bg-indigo-100 text-indigo-800' },
  APROVADO:  { label: 'Aprovado',  cls: 'bg-green-100 text-green-800' },
  RECUSADO:  { label: 'Recusado',  cls: 'bg-red-100 text-red-800' },
  EXPIRADO:  { label: 'Expirado',  cls: 'bg-gray-200 text-gray-700' },
  ESTORNADO: { label: 'Estornado', cls: 'bg-yellow-100 text-yellow-800' },
};

export const SAGA_STATUS_META = {
  STARTED:      { label: 'Em andamento', cls: 'bg-blue-100 text-blue-800' },
  COMPENSATING: { label: 'Compensando',  cls: 'bg-orange-100 text-orange-800' },
  COMPLETED:    { label: 'Concluída',    cls: 'bg-green-100 text-green-800' },
  COMPENSATED:  { label: 'Compensada',   cls: 'bg-gray-200 text-gray-700' },
  FAILED:       { label: 'Falhou',       cls: 'bg-red-100 text-red-800' },
};

export function metaBadge(meta, value) {
  const m = meta[value] || { label: value, cls: NEUTRAL };
  return `<span class="inline-block px-2 py-0.5 text-xs font-semibold rounded-full ${m.cls}">${escapeHtml(m.label)}</span>`;
}

const ITEM_EDIT_STATUSES = new Set(['RECEBIDA', 'EM_DIAGNOSTICO']);
const TERMINAL_STATUSES = new Set(['FINALIZADA', 'ENTREGUE', 'CANCELADA']);
const CLOSED_SAGA_STATUSES = new Set(['COMPENSATING', 'COMPENSATED', 'COMPLETED', 'FAILED']);

export function canEditItems(status, sagaStatus) {
  return ITEM_EDIT_STATUSES.has(status) && !CLOSED_SAGA_STATUSES.has(sagaStatus);
}

export function canDeliver(status) {
  return status === 'FINALIZADA';
}

export function canRequestCancel(status, sagaStatus) {
  if (TERMINAL_STATUSES.has(status)) return false;
  return !CLOSED_SAGA_STATUSES.has(sagaStatus);
}

export function qrImageUrl(pageUrl) {
  return pageUrl ? `${pageUrl}.png` : '';
}

export function qrCodeFromUrl(pageUrl, qrData = '') {
  if (!pageUrl) return null;
  return { pageUrl, imageUrl: qrImageUrl(pageUrl), qrData: qrData || '' };
}

export function pendingQRCode(quote) {
  const payments = quote?.payments || [];
  const pending = payments.filter(p => p.status === 'PENDENTE' && p.qr_code_url);
  if (!pending.length) return null;
  const last = pending[pending.length - 1];
  return qrCodeFromUrl(last.qr_code_url, last.qr_data);
}

export function qrCodeHtml(qr) {
  if (!qr) return '';
  const copy = qr.qrData ? `
      <label class="block text-xs font-medium mt-3 mb-1">Pix copia e cola</label>
      <textarea readonly rows="3" onclick="this.select()" class="w-full font-mono text-xs border border-gray-300 rounded p-2 bg-white">${escapeHtml(qr.qrData)}</textarea>` : '';
  return `<div class="flex flex-col sm:flex-row items-start gap-4">
      <img src="${escapeAttr(qr.imageUrl)}" alt="QR Code de pagamento do Mercado Pago" width="180" height="180" class="bg-white rounded border border-gray-200">
      <div class="flex-1 min-w-0 w-full">
        <p class="text-sm">Escaneie o QR Code com o app do Mercado Pago ou do banco.</p>${copy}
        <a href="${escapeAttr(qr.pageUrl)}" target="_blank" rel="noopener" class="inline-block mt-3 text-sm font-medium hover:underline break-all">Abrir a página do QR Code</a>
      </div>
    </div>`;
}

export function approvalPageUrl(origin, { quoteId, code, document } = {}) {
  const params = new URLSearchParams();
  if (quoteId) params.set('quote', quoteId);
  if (code) params.set('code', code);
  if (document) params.set('document', document);
  return `${origin}/aprovacao.html?${params.toString()}`;
}

export function hasPendingDecision(quote) {
  if (!quote || quote.status !== 'ENVIADO') return false;
  return (quote.items || []).some(i => i.decision === 'PENDENTE');
}

const BRANCH_PATTERN = /^[A-Za-z0-9_-]{1,40}$/;

export function isValidBranch(branch) {
  return BRANCH_PATTERN.test(String(branch ?? ''));
}

export function ticketActions(ticket) {
  if (!ticket) return [];
  switch (ticket.status) {
    case 'DIAGNOSTICO_NA_FILA': return [{ action: 'diagnosis-start', label: 'Iniciar diagnóstico', needs: 'technician' }];
    case 'EM_DIAGNOSTICO':      return [{ action: 'diagnosis-complete', label: 'Concluir diagnóstico', needs: 'notes' }];
    case 'REPARO_NA_FILA':      return [{ action: 'repair-start', label: 'Iniciar reparo', needs: 'technician' }];
    default:                    return [];
  }
}

export function itemAction(ticket, item) {
  if (ticket?.status !== 'EM_REPARO' || !item) return null;
  if (item.status === 'PENDENTE') return { action: 'start', label: 'Iniciar item' };
  if (item.status === 'EM_EXECUCAO') return { action: 'finish', label: 'Finalizar item' };
  return null;
}

const TICKET_ACTION_PATHS = {
  'diagnosis-start':    'diagnosis/start',
  'diagnosis-complete': 'diagnosis/complete',
  'repair-start':       'repair/start',
};

export function ticketActionPath(workOrderId, action, itemId) {
  const base = `/execution/tickets/${encodeURIComponent(workOrderId)}`;
  if (action === 'start' || action === 'finish') {
    return `${base}/items/${encodeURIComponent(itemId)}/${action}`;
  }
  const suffix = TICKET_ACTION_PATHS[action];
  if (!suffix) throw new Error(`acao desconhecida: ${action}`);
  return `${base}/${suffix}`;
}

export function errorMessage(status, body, fallback) {
  const msg = body && (body.error || body.message);
  return msg || fallback || `Erro ${status}`;
}
