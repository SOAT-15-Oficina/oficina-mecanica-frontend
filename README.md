# oficina-mecanica-frontend

Painel web da oficina: board de ordens de serviço, cadastros (clientes,
veículos, serviços, insumos), abertura de OS e a página pública de aprovação de
orçamento.

HTML + JavaScript estático, sem bundler e sem framework. Servido por **S3 +
CloudFront**.

> **Visão de arquitetura do sistema completo** vive em
> [`oficina-mecanica-infrastructure`](https://github.com/SOAT-15-Oficina/oficina-mecanica-infrastructure).
> Este README cobre apenas este repositório.

## Como o painel encontra a API

Não há URL de API para configurar, e **não há CORS**. Uma única distribuição
CloudFront serve as duas coisas:

```
CloudFront ─┬─ /*      → bucket S3 (este repositório)
            └─ /api/*  → API Gateway ─┬─ /auth/*  → Lambda
                                      └─ /*       → ALB interno → EKS
```

Como painel e API compartilham a origem, `shared/app.js` só precisa do prefixo:

```js
const API_BASE = '/api';
```

Uma CloudFront Function remove o `/api` antes de repassar à origem, então o
monolito continua servindo `/customers` — sem nenhuma mudança de rota lá.

## Estrutura

```
*.html                 uma página por tela; cada uma com seu bloco <script>
shared/helpers.js      funções puras (ES module) — o que os testes cobrem
shared/app.js          camada de navegador: fetch, sessão, layout, toast, modal
shared/style.css
scripts/check-pages.mjs valida sintaxe e handlers das páginas no CI
tests/                 Vitest
```

### Por que `helpers.js` existe separado

`escapeHtml`/`escapeAttr` são a **única defesa contra XSS** do painel: todo dado
vindo da API passa por elas antes de virar `innerHTML`. Extraí-las para um módulo
puro é o que torna possível testá-las — e elas não tinham nenhum teste antes.

`shared/app.js` é um **módulo ES** que importa de `helpers.js` e publica a
superfície pública em `window`, porque as páginas usam handlers inline
(`onclick="logout()"`), que resolvem no escopo global. Como módulos são
deferidos, o bloco `<script>` de cada página está dentro de um
`DOMContentLoaded`, garantindo que `app.js` já executou.

Se você adicionar um handler inline, `scripts/check-pages.mjs` falha o CI caso a
função não exista.

## Rodando local

```bash
npm install
npm run serve      # http://localhost:3000
```

Servido assim, o painel carrega mas **nenhuma chamada à API funciona** — não há
nada em `/api`. Para o fluxo completo (front + Lambda + monolito atrás de um
nginx que replica o roteamento do CloudFront), use `docker-compose.local.yml` no
repositório de infraestrutura.

## Testes

```bash
npm test            # Vitest (jsdom)
npm run coverage    # cobertura de shared/helpers.js
node scripts/check-pages.mjs
```

Os testes cobrem as funções puras: escape de HTML/atributo, `parseJwt`,
`formatCents`, `formatDate`, `statusBadge` e a consistência das tabelas de
status. `app.js` e as páginas ficam fora da métrica de cobertura — exercitá-los
exigiria E2E, que foi deixado fora de escopo.

## Qualidade

```bash
docker compose -f docker-compose.sonar.yml up -d sonarqube   # :9002
npm run coverage
docker compose -f docker-compose.sonar.yml run --rm sonar-scanner
```

O CI sobe uma instância equivalente como service container efêmero e o Quality
Gate **bloqueia o merge**. Sem histórico entre execuções, o gate é avaliado sobre
o código todo, não sobre *new code*.

## Pipeline

| Gatilho | O que roda |
|---|---|
| PR → `main` ou `hml` | actionlint, Vitest com cobertura, validação das páginas, SonarQube + Quality Gate |
| Push → `main` ou `hml` | `aws s3 sync`, invalidação do CloudFront, smoke check na URL pública |

Deploy por **OIDC** (sem access key), resolvendo os destinos no SSM:

| Parâmetro | Uso |
|---|---|
| `/oficina-mecanica/<ambiente>/frontend_bucket_name` | destino do `s3 sync` |
| `/oficina-mecanica/<ambiente>/cloudfront_distribution_id` | invalidação |
| `/oficina-mecanica/<ambiente>/public_domain` | smoke check |

S3 e CloudFront vivem na **camada persistente** do Terraform: sobrevivem ao ciclo
de `bring-up`/`tear-down`, então essa URL não muda entre apresentações. O bucket
é privado, acessível apenas pelo CloudFront via **OAC**.

Os HTML sobem com `no-cache` (um deploy aparece imediatamente) e `shared/` com
`max-age=86400`, invalidado a cada release.

### Dois ambientes

A **branch** escolhe o destino: `hml` publica em homologação, `main` em produção.
Não há input de ambiente em lugar nenhum deste repositório — o `ref` já carrega a
informação, e um input separado poderia contradizê-lo.

| | homologação | produção |
|---|---|---|
| Branch | `hml` | `main` |
| GitHub Environment | `homolog` | `production` |
| Prefixo no SSM | `/oficina-mecanica/homolog` | `/oficina-mecanica/prod` |

Por isso `AWS_DEPLOY_ROLE_ARN` é secret de **GitHub Environment**, não de
repositório: os dois ambientes usam o mesmo nome de secret e apenas o escopo do
Environment os separa. A trust policy da role repete a regra do lado da AWS — um
push em `hml` não obtém credencial de produção.

Arquitetura completa dos dois ambientes: `oficina-mecanica-infrastructure`.

### Secrets e variables necessários

| Nome | Tipo | Conteúdo |
|---|---|---|
| `AWS_DEPLOY_ROLE_ARN` | secret de **Environment** (`production` e `homolog`) | role assumida por OIDC (`s3:PutObject` no bucket + `cloudfront:CreateInvalidation`) |
| `AWS_REGION` | variable | `sa-east-1` |

## O que mudou ao sair do monolito

O painel era servido pelo binário Go em `/web*` e embutido na imagem Docker.
Migrando para S3:

- caminhos `/web/*.html` viraram `/*.html`, e `/web/shared/` virou `/shared/`;
- as chamadas ganharam o prefixo `/api`;
- `app.js` virou módulo ES e os blocos das páginas foram para `DOMContentLoaded`;
- `statusBadge` passou a escapar o rótulo — um status desconhecido vindo da API
  era interpolado cru em `innerHTML`. Há um teste travando essa regressão.
