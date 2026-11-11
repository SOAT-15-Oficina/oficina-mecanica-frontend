import { describe, it, expect } from 'vitest';
import {
  TICKET_STATUS_META, ITEM_STATUS_META, DECISION_META, QUOTE_STATUS_META,
  PAYMENT_STATUS_META, SAGA_STATUS_META,
  metaBadge, canEditItems, canDeliver, canRequestCancel, pendingPaymentUrl,
  approvalPageUrl, hasPendingDecision, isValidBranch, ticketActions, itemAction,
  ticketActionPath, errorMessage,
} from '../shared/helpers.js';

describe('tabelas de metadados dos servicos', () => {
  it.each([
    ['ticket', TICKET_STATUS_META, ['DIAGNOSTICO_NA_FILA', 'EM_DIAGNOSTICO', 'DIAGNOSTICADO', 'REPARO_NA_FILA', 'EM_REPARO', 'CONCLUIDO', 'CANCELADO']],
    ['item', ITEM_STATUS_META, ['PENDENTE', 'EM_EXECUCAO', 'FINALIZADO']],
    ['decisao', DECISION_META, ['PENDENTE', 'APROVADO', 'REPROVADO']],
    ['orcamento', QUOTE_STATUS_META, ['ENVIADO', 'APROVADO', 'REPROVADO', 'CANCELADO']],
    ['pagamento', PAYMENT_STATUS_META, ['PENDENTE', 'APROVADO', 'RECUSADO', 'EXPIRADO', 'ESTORNADO']],
    ['saga', SAGA_STATUS_META, ['STARTED', 'COMPENSATING', 'COMPLETED', 'COMPENSATED', 'FAILED']],
  ])('%s cobre todos os valores do contrato', (_, meta, values) => {
    for (const v of values) {
      expect(meta[v], v).toBeDefined();
      expect(meta[v].label).toBeTruthy();
      expect(meta[v].cls).toMatch(/^bg-/);
    }
  });
});

describe('metaBadge', () => {
  it('usa rotulo e classe do valor conhecido', () => {
    const html = metaBadge(SAGA_STATUS_META, 'COMPENSATING');
    expect(html).toContain('Compensando');
    expect(html).toContain('bg-orange-100');
  });

  it('escapa valor desconhecido e cai no estilo neutro', () => {
    const html = metaBadge(SAGA_STATUS_META, '<b>x</b>');
    expect(html).not.toContain('<b>');
    expect(html).toContain('&lt;b&gt;');
    expect(html).toContain('bg-gray-100');
  });
});

describe('regras de acao da OS', () => {
  it.each([
    ['RECEBIDA', true], ['EM_DIAGNOSTICO', true], ['AGUARDANDO_APROVACAO', false],
    ['AGUARDANDO_PAGAMENTO', false], ['APROVADO', false], ['EM_EXECUCAO', false],
  ])('itens editaveis em %s: %s', (status, expected) => {
    expect(canEditItems(status)).toBe(expected);
  });

  it('itens travam quando a saga ja esta compensando ou encerrada', () => {
    expect(canEditItems('RECEBIDA', 'STARTED')).toBe(true);
    expect(canEditItems('RECEBIDA', 'COMPENSATING')).toBe(false);
    expect(canEditItems('EM_DIAGNOSTICO', 'FAILED')).toBe(false);
  });

  it('entrega apenas em FINALIZADA', () => {
    expect(canDeliver('FINALIZADA')).toBe(true);
    expect(canDeliver('EM_EXECUCAO')).toBe(false);
  });

  it.each([
    ['RECEBIDA', 'STARTED', true],
    ['AGUARDANDO_PAGAMENTO', undefined, true],
    ['EM_EXECUCAO', 'STARTED', true],
    ['FINALIZADA', 'COMPLETED', false],
    ['ENTREGUE', 'COMPLETED', false],
    ['CANCELADA', 'COMPENSATED', false],
    ['AGUARDANDO_APROVACAO', 'COMPENSATING', false],
    ['RECEBIDA', 'FAILED', false],
  ])('cancelamento em %s com saga %s: %s', (status, saga, expected) => {
    expect(canRequestCancel(status, saga)).toBe(expected);
  });
});

describe('pendingPaymentUrl', () => {
  it('devolve o checkout do pagamento pendente mais recente', () => {
    const quote = { payments: [
      { status: 'RECUSADO', checkout_url: 'http://a' },
      { status: 'PENDENTE', checkout_url: 'http://b' },
      { status: 'PENDENTE', checkout_url: 'http://c' },
    ] };
    expect(pendingPaymentUrl(quote)).toBe('http://c');
  });

  it.each([
    ['sem orcamento', null],
    ['sem pagamentos', {}],
    ['so pagamentos fechados', { payments: [{ status: 'APROVADO', checkout_url: 'http://a' }] }],
    ['pendente sem link', { payments: [{ status: 'PENDENTE' }] }],
  ])('string vazia quando %s', (_, quote) => {
    expect(pendingPaymentUrl(quote)).toBe('');
  });
});

describe('approvalPageUrl', () => {
  it('monta o link com quote, codigo e documento codificados', () => {
    const url = approvalPageUrl('http://x', { quoteId: 'q-1', code: 'OS 1', document: '123&4' });
    const parsed = new URL(url);
    expect(parsed.pathname).toBe('/aprovacao.html');
    expect(parsed.searchParams.get('quote')).toBe('q-1');
    expect(parsed.searchParams.get('code')).toBe('OS 1');
    expect(parsed.searchParams.get('document')).toBe('123&4');
  });

  it('omite parametros ausentes', () => {
    expect(approvalPageUrl('http://x', { quoteId: 'q' })).toBe('http://x/aprovacao.html?quote=q');
    expect(approvalPageUrl('http://x')).toBe('http://x/aprovacao.html?');
  });
});

describe('hasPendingDecision', () => {
  it('verdadeiro com orcamento enviado e item pendente', () => {
    expect(hasPendingDecision({ status: 'ENVIADO', items: [{ decision: 'APROVADO' }, { decision: 'PENDENTE' }] })).toBe(true);
  });

  it.each([
    ['nulo', null],
    ['ja aprovado', { status: 'APROVADO', items: [{ decision: 'PENDENTE' }] }],
    ['tudo decidido', { status: 'ENVIADO', items: [{ decision: 'REPROVADO' }] }],
    ['sem itens', { status: 'ENVIADO' }],
  ])('falso quando %s', (_, quote) => {
    expect(hasPendingDecision(quote)).toBe(false);
  });
});

describe('isValidBranch', () => {
  it.each(['MATRIZ', 'filial_2', 'SP-01', 'A'.repeat(40)])('aceita %s', (b) => {
    expect(isValidBranch(b)).toBe(true);
  });

  it.each(['', null, undefined, 'com espaco', '../x', 'A'.repeat(41), 'ç'])('recusa %s', (b) => {
    expect(isValidBranch(b)).toBe(false);
  });
});

describe('acoes da bancada', () => {
  it.each([
    ['DIAGNOSTICO_NA_FILA', 'diagnosis-start', 'technician'],
    ['EM_DIAGNOSTICO', 'diagnosis-complete', 'notes'],
    ['REPARO_NA_FILA', 'repair-start', 'technician'],
  ])('ticket em %s oferece %s', (status, action, needs) => {
    expect(ticketActions({ status })).toEqual([expect.objectContaining({ action, needs })]);
  });

  it.each(['DIAGNOSTICADO', 'EM_REPARO', 'CONCLUIDO', 'CANCELADO'])('ticket em %s nao tem acao de ficha', (status) => {
    expect(ticketActions({ status })).toEqual([]);
  });

  it('sem ticket nao ha acao', () => {
    expect(ticketActions(null)).toEqual([]);
  });

  it('itens so tem acao com o ticket EM_REPARO', () => {
    const repair = { status: 'EM_REPARO' };
    expect(itemAction(repair, { status: 'PENDENTE' }).action).toBe('start');
    expect(itemAction(repair, { status: 'EM_EXECUCAO' }).action).toBe('finish');
    expect(itemAction(repair, { status: 'FINALIZADO' })).toBeNull();
    expect(itemAction(repair, null)).toBeNull();
    expect(itemAction({ status: 'REPARO_NA_FILA' }, { status: 'PENDENTE' })).toBeNull();
    expect(itemAction(null, { status: 'PENDENTE' })).toBeNull();
  });
});

describe('ticketActionPath', () => {
  it.each([
    ['diagnosis-start', '/execution/tickets/w1/diagnosis/start'],
    ['diagnosis-complete', '/execution/tickets/w1/diagnosis/complete'],
    ['repair-start', '/execution/tickets/w1/repair/start'],
  ])('%s', (action, path) => {
    expect(ticketActionPath('w1', action)).toBe(path);
  });

  it('acoes de item usam o id do item', () => {
    expect(ticketActionPath('w1', 'start', 'i1')).toBe('/execution/tickets/w1/items/i1/start');
    expect(ticketActionPath('w1', 'finish', 'i1')).toBe('/execution/tickets/w1/items/i1/finish');
  });

  it('codifica ids para nao sair do caminho', () => {
    expect(ticketActionPath('../x', 'start', 'a/b')).toBe('/execution/tickets/..%2Fx/items/a%2Fb/start');
  });

  it('lanca para acao desconhecida', () => {
    expect(() => ticketActionPath('w1', 'explodir')).toThrow('acao desconhecida');
  });
});

describe('errorMessage', () => {
  it('prefere error, depois message', () => {
    expect(errorMessage(409, { error: 'after pivot' })).toBe('after pivot');
    expect(errorMessage(400, { message: 'bad' })).toBe('bad');
  });

  it('cai no fallback e depois no codigo', () => {
    expect(errorMessage(500, null, 'Internal')).toBe('Internal');
    expect(errorMessage(502, {}, '')).toBe('Erro 502');
  });
});
