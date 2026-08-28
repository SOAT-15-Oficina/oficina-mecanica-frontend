import { describe, it, expect } from 'vitest';
import {
  parseJwt, escapeHtml, escapeAttr, formatCents, formatDate, statusBadge,
  STATUS_META, STATUS_ORDER, STATUS_ACTIONS,
} from '../shared/helpers.js';

// escapeHtml e escapeAttr sao a UNICA defesa contra XSS do painel: todo dado
// vindo da API passa por elas antes de virar innerHTML. Se alguem "otimizar"
// uma dessas substituicoes, o painel vira um vetor de execucao de script.
describe('escapeHtml', () => {
  it('neutraliza uma tag script', () => {
    expect(escapeHtml('<script>alert(1)</script>'))
      .toBe('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('escapa aspas duplas e simples, que quebrariam um atributo', () => {
    expect(escapeHtml(`" onerror="alert(1)`)).toBe('&quot; onerror=&quot;alert(1)');
    expect(escapeHtml(`' onerror='alert(1)`)).toBe('&#39; onerror=&#39;alert(1)');
  });

  // O & precisa ser trocado primeiro, senao "&lt;" viraria "&amp;lt;" e um
  // payload como "&lt;script&gt;" poderia ser reconstituido no DOM.
  it('escapa o & antes dos demais, sem duplo escape', () => {
    expect(escapeHtml('a & b')).toBe('a &amp; b');
    expect(escapeHtml('&lt;')).toBe('&amp;lt;');
  });

  it('trata null e undefined como string vazia', () => {
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(undefined)).toBe('');
  });

  it('converte valores nao-string sem lancar', () => {
    expect(escapeHtml(42)).toBe('42');
    expect(escapeHtml(0)).toBe('0');
    expect(escapeHtml(false)).toBe('false');
  });

  it('escapeAttr aplica as mesmas regras', () => {
    const payload = `"><img src=x onerror=alert(1)>`;
    expect(escapeAttr(payload)).toBe(escapeHtml(payload));
    expect(escapeAttr(payload)).not.toContain('<');
    expect(escapeAttr(payload)).not.toContain('"');
  });
});

describe('parseJwt', () => {
  const encode = (payload) =>
    'h.' + btoa(JSON.stringify(payload)).replace(/\+/g, '-').replace(/\//g, '_') + '.s';

  it('extrai o payload', () => {
    expect(parseJwt(encode({ user: 'alice', role: 'admin' })))
      .toEqual({ user: 'alice', role: 'admin' });
  });

  it('aceita base64url (- e _ no lugar de + e /)', () => {
    const claims = { user: 'ação?>>', role: 'employee' };
    expect(parseJwt(encode(claims))).toEqual(claims);
  });

  // Um token corrompido no localStorage nao pode derrubar a pagina inteira.
  it.each([
    ['string vazia', ''],
    ['sem pontos', 'nao-e-um-token'],
    ['payload nao-base64', 'h.!!!.s'],
    ['payload que nao e json', 'h.' + btoa('nao é json') + '.s'],
  ])('devolve null para %s em vez de lancar', (_, token) => {
    expect(parseJwt(token)).toBeNull();
  });
});

describe('formatCents', () => {
  it.each([
    [0, 'R$ 0,00'],
    [1, 'R$ 0,01'],
    [12345, 'R$ 123,45'],
    [100000, 'R$ 1000,00'],
  ])('formata %i como %s', (cents, expected) => {
    expect(formatCents(cents)).toBe(expected);
  });

  it('formata valores negativos', () => {
    expect(formatCents(-500)).toBe('R$ -5,00');
  });
});

describe('formatDate', () => {
  it.each([
    ['null', null],
    ['undefined', undefined],
    ['string vazia', ''],
  ])('devolve string vazia para %s', (_, value) => {
    expect(formatDate(value)).toBe('');
  });

  it('formata uma data ISO no padrao pt-BR', () => {
    expect(formatDate('2026-03-15T14:30:00Z')).toMatch(/^\d{2}\/\d{2}\/\d{4}/);
  });
});

describe('statusBadge', () => {
  it('usa o rotulo e as cores do status conhecido', () => {
    const html = statusBadge('EM_EXECUCAO');
    expect(html).toContain('Em execução');
    expect(html).toContain(STATUS_META.EM_EXECUCAO.bg);
  });

  // Status desconhecido chega da API. Antes do split ele era interpolado cru
  // em innerHTML -- este teste trava a regressao.
  it('escapa um status desconhecido em vez de injeta-lo cru', () => {
    const html = statusBadge('<img src=x onerror=alert(1)>');
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img');
  });

  it('cai em estilo neutro para status desconhecido', () => {
    expect(statusBadge('FOO')).toContain('bg-gray-100');
  });
});

describe('tabelas de status', () => {
  it('todo status da ordem tem metadados', () => {
    for (const s of STATUS_ORDER) {
      expect(STATUS_META[s], `${s} sem metadados`).toBeDefined();
    }
  });

  // CANCELADA existe em META mas nao na ORDER: e um estado terminal fora do
  // fluxo linear do painel, nao um esquecimento.
  it('CANCELADA tem metadados mas fica fora da ordem operacional', () => {
    expect(STATUS_META.CANCELADA).toBeDefined();
    expect(STATUS_ORDER).not.toContain('CANCELADA');
  });

  it('toda transicao aponta para um status conhecido', () => {
    for (const [from, action] of Object.entries(STATUS_ACTIONS)) {
      expect(STATUS_META[from], `origem ${from} desconhecida`).toBeDefined();
      expect(STATUS_META[action.next], `destino ${action.next} desconhecido`).toBeDefined();
    }
  });
});
