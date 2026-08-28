// O painel nao tem bundler: o HTML/JS versionado e exatamente o que vai para o
// S3. Nenhuma ferramenta olha para os blocos <script> inline das paginas, entao
// um erro de sintaxe so apareceria no browser de quem abrisse a pagina.
//
// Este script valida, para cada pagina:
//   1. que todo bloco inline e JavaScript sintaticamente valido;
//   2. que toda funcao referenciada por um handler inline (onclick=, onchange=)
//      esta declarada no bloco daquela pagina ou publicada por shared/app.js.
//
// Roda no CI antes do deploy.
import { readFileSync, readdirSync } from 'node:fs';
import vm from 'node:vm';

const GLOBALS_FROM_APP_JS = new Set([
  'api', 'requireAuth', 'getUser', 'logout',
  'initLayout', 'setPageTitle',
  'showToast', 'showError', 'openModal', 'closeModal',
  'parseJwt', 'escapeHtml', 'escapeAttr', 'formatCents', 'formatDate', 'statusBadge',
]);

const pages = readdirSync('.').filter((f) => f.endsWith('.html'));
let failures = 0;

for (const page of pages) {
  const html = readFileSync(page, 'utf8');
  const blocks = [...html.matchAll(/<script>\n([\s\S]*?)\n\s*<\/script>/g)].map((m) => m[1]);

  const declared = new Set();
  for (const [i, code] of blocks.entries()) {
    try {
      new vm.Script(code, { filename: `${page}#inline${i}` });
    } catch (err) {
      console.error(`✗ ${page}: bloco inline ${i} nao compila -- ${err.message}`);
      failures++;
    }
    for (const m of code.matchAll(/^\s*(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/gm)) {
      declared.add(m[1]);
    }
  }

  const referenced = new Set(
    [...html.matchAll(/on(?:click|change|input|submit)="([A-Za-z_$][\w$]*)\(/g)].map((m) => m[1]),
  );
  const missing = [...referenced].filter((f) => !declared.has(f) && !GLOBALS_FROM_APP_JS.has(f));
  if (missing.length) {
    console.error(`✗ ${page}: handlers sem funcao correspondente -- ${missing.join(', ')}`);
    failures++;
  }

  // Toda chamada a API tem de passar pelo prefixo /api. Sem ele o request cai
  // no cache behavior default do CloudFront, que so aceita GET/HEAD/OPTIONS --
  // um POST volta 403 antes de chegar ao API Gateway. Foi assim que o login
  // quebrou em producao depois da migracao do painel para o S3.
  const badFetches = [...html.matchAll(/fetch\(\s*([`'"])([^`'"]*)\1/g)]
    .map((m) => m[2])
    .filter((url) => url.startsWith('/') && !url.startsWith('/api/'));
  if (badFetches.length) {
    console.error(`✗ ${page}: fetch sem prefixo /api -- ${badFetches.join(', ')}`);
    failures++;
  }

  if (!missing.length && !badFetches.length) {
    console.log(`✓ ${page} (${blocks.length} bloco(s), ${referenced.size} handler(s))`);
  }
}

if (failures) {
  console.error(`\n${failures} problema(s) encontrado(s).`);
  process.exit(1);
}
console.log(`\n${pages.length} paginas validadas.`);
