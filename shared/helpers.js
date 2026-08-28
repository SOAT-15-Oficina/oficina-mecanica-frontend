// Funcoes puras do painel: sem DOM, sem rede, sem estado global.
//
// Vivem separadas de app.js justamente para serem testaveis em isolamento --
// em especial escapeHtml/escapeAttr, que sao a unica defesa contra XSS de todo
// o painel (cada innerHTML das paginas passa por elas).

export const STATUS_META = {
  RECEBIDA:             { label: 'Recebida',            bg: 'bg-blue-100',    text: 'text-blue-800'    },
  EM_DIAGNOSTICO:       { label: 'Em diagnóstico',      bg: 'bg-yellow-100',  text: 'text-yellow-800'  },
  AGUARDANDO_APROVACAO: { label: 'Aguardando aprovação', bg: 'bg-orange-100',  text: 'text-orange-800'  },
  APROVADO:             { label: 'Aprovado',            bg: 'bg-green-100',   text: 'text-green-800'   },
  EM_EXECUCAO:          { label: 'Em execução',         bg: 'bg-purple-100',  text: 'text-purple-800'  },
  FINALIZADA:           { label: 'Finalizada',          bg: 'bg-teal-100',    text: 'text-teal-800'    },
  ENTREGUE:             { label: 'Entregue',            bg: 'bg-emerald-100', text: 'text-emerald-800' },
  CANCELADA:            { label: 'Cancelada',           bg: 'bg-red-100',     text: 'text-red-800'     },
};

export const STATUS_ORDER = [
  'RECEBIDA', 'EM_DIAGNOSTICO', 'AGUARDANDO_APROVACAO', 'APROVADO',
  'EM_EXECUCAO', 'FINALIZADA', 'ENTREGUE',
];

export const STATUS_ACTIONS = {
  RECEBIDA:       { next: 'EM_DIAGNOSTICO',       label: 'Iniciar diagnóstico', cls: 'bg-yellow-500 hover:bg-yellow-600' },
  EM_DIAGNOSTICO: { next: 'AGUARDANDO_APROVACAO', label: 'Enviar orçamento',    cls: 'bg-orange-500 hover:bg-orange-600' },
  APROVADO:       { next: 'EM_EXECUCAO',          label: 'Iniciar execução',    cls: 'bg-purple-500 hover:bg-purple-600' },
  FINALIZADA:     { next: 'ENTREGUE',             label: 'Registrar entrega',   cls: 'bg-emerald-500 hover:bg-emerald-600' },
};

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
