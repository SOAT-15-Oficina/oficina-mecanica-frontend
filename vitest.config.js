import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // parseJwt usa atob e o painel manipula DOM; jsdom cobre os dois.
    environment: 'jsdom',
    include: ['tests/**/*.test.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      reportsDirectory: 'coverage',
      // O alvo dos testes sao as funcoes puras. app.js e wiring de navegador
      // (fetch, localStorage, innerHTML) e as paginas nao tem logica propria
      // testavel sem um browser de verdade.
      include: ['shared/helpers.js'],
    },
  },
});
