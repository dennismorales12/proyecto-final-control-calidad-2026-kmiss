const { test } = require('node:test');
const assert = require('node:assert/strict');
const { seleccionarProyecto } = require('./configurar-sonar.cjs');

for (const [rama, clave] of Object.entries({
  DEV: 'dennismorales12_kmiss-dev',
  QA: 'dennismorales12_kmiss-qa',
  main: 'dennismorales12_proyecto-final-control-calidad-2026-kmiss',
})) {
  test(`El push de ${rama} usa su propio proyecto`, () => {
    assert.equal(seleccionarProyecto({ BUILD_SOURCEBRANCH: `refs/heads/${rama}` }).clave, clave);
  });
  test(`La revisión hacia ${rama} usa el proyecto de destino`, () => {
    assert.equal(seleccionarProyecto({ BUILD_REASON: 'PullRequest', BUILD_SOURCEBRANCH: 'refs/pull/9/merge', SYSTEM_PULLREQUEST_TARGETBRANCH: rama }).clave, clave);
  });
}

test('Un PR sin destino se bloquea aunque el origen sea main', () => {
  assert.throws(() => seleccionarProyecto({ BUILD_REASON: 'PullRequest', BUILD_SOURCEBRANCH: 'refs/heads/main' }), /No hay proyecto/);
});
test('Una rama desconocida se bloquea sin reutilizar producción', () => {
  assert.throws(() => seleccionarProyecto({ BUILD_SOURCEBRANCH: 'refs/heads/feature/cambio' }), /No hay proyecto/);
});
test('Una etiqueta no se confunde con una rama de ambiente', () => {
  assert.throws(() => seleccionarProyecto({ BUILD_SOURCEBRANCH: 'refs/tags/DEV' }), /No hay proyecto/);
});
