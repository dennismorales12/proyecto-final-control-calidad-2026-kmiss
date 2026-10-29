const proyectos = Object.freeze({
  DEV: { clave: 'dennismorales12_kmiss-dev', nombre: 'KMISS - Desarrollo' },
  QA: { clave: 'dennismorales12_kmiss-qa', nombre: 'KMISS - Calidad' },
  main: { clave: 'dennismorales12_proyecto-final-control-calidad-2026-kmiss', nombre: 'Proyecto Final Control de Calidad 2026 KMISS' },
});

function seleccionarProyecto(entorno) {
  const referencia = entorno.BUILD_REASON === 'PullRequest'
    ? entorno.SYSTEM_PULLREQUEST_TARGETBRANCH
    : entorno.BUILD_SOURCEBRANCH;
  const rama = (referencia || '').replace(/^refs\/heads\//, '');
  if (!Object.hasOwn(proyectos, rama)) {
    throw new Error(`No hay proyecto Sonar configurado para la rama: ${rama || '(ausente)'}`);
  }
  return { rama, ...proyectos[rama] };
}

if (require.main === module) {
  try {
    const proyecto = seleccionarProyecto(process.env);
    console.log(`SonarCloud: ${proyecto.nombre}; rama destino ${proyecto.rama}.`);
    console.log(`##vso[task.setvariable variable=proyectoSonar]${proyecto.clave}`);
    console.log(`##vso[task.setvariable variable=nombreProyectoSonar]${proyecto.nombre}`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = { seleccionarProyecto };
