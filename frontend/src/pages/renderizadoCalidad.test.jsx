import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, expect, test, vi } from 'vitest';

// Aísla estado y efectos: prueba el renderizado, no navegación ni eventos reales.
const estado = vi.hoisted(() => ({ indice: 0, valores: {}, cambios: {} }));
vi.mock('react', async (importOriginal) => {
  const original = await importOriginal();
  return { ...original, useEffect: vi.fn(), useState: (inicial) => {
    const indice = estado.indice++;
    const valor = Object.hasOwn(estado.valores, indice) ? estado.valores[indice] : (typeof inicial === 'function' ? inicial() : inicial);
    const cambiar = vi.fn();
    estado.cambios[indice] = cambiar;
    return [valor, cambiar];
  } };
});
import Tienda from './Tienda';
import Ajustes from './Ajustes';
beforeEach(() => { estado.indice = 0; estado.valores = {}; estado.cambios = {}; });
const producto = { id: 1, nombre: 'Crema de prueba', precio: 100, stock_actual: 3, categoria: 'Cuidado', descuento_porcentaje: 10, precio_final: 90 };
const servicio = { id: 1, nombre: 'Consulta de prueba', precio: 100, duracion_minutos: 30 };
function mostrar(Componente, valores) {
  estado.valores = valores;
  return renderToStaticMarkup(React.createElement(Componente));
}

test.each([
  ['carga inicial', {}, 'Cargando catálogo'],
  ['catálogo vacío', {7:false}, 'No hay productos disponibles'],
  ['productos agrupados', {0:[producto],7:false}, 'Crema de prueba'],
  ['servicios vacíos', {5:'servicios',7:false}, 'No hay servicios disponibles'],
  ['servicio con precio', {1:[servicio],5:'servicios',7:false}, 'Consulta de prueba'],
  ['sedes vacías', {5:'sedes',7:false}, 'Próximamente publicaremos nuestras ubicaciones'],
  ['sede con teléfono', {2:[{id:1,nombre:'Sede de prueba',direccion:'Dirección QA',telefono:'55550000'}],5:'sedes',7:false}, 'tel:55550000'],
  ['noticias vacías', {5:'noticias',7:false}, 'No hay noticias publicadas'],
  ['noticia publicada', {3:[{id:1,titulo:'Noticia de prueba',resumen:'Resumen',contenido:'Contenido',enlace_url:'https://example.test',fecha_evento:'2035-01-01'}],5:'noticias',7:false}, 'Noticia de prueba'],
  ['detalle de servicio', {16:servicio}, 'servicio-detalle-modal'],
  ['formulario de cita', {14:true}, 'Solicitar cita'],
  ['confirmación de cita', {15:{id:88}}, 'Solicitud recibida'],
  ['carrito vacío', {9:true}, 'Tu carrito está vacío'],
  ['carrito con producto', {8:[{producto_id:1,nombre:'Crema de prueba',precio:90,cantidad:1,stock_actual:3}],9:true}, 'Continuar al pedido'],
  ['formulario de pedido', {10:true}, 'Completa tu pedido'],
  ['pedido recibido', {11:{id:22}}, '¡Pedido recibido!'],
])('Tienda mantiene %s tras separar las vistas', (_, valores, esperado) => {
  expect(mostrar(Tienda,valores)).toContain(esperado);
});

test.each([
  ['pantalla inicial', {}, 'Catálogos y parámetros'],
  ['categoría nueva', {1:true}, 'Nueva categoría'],
  ['categoría en edición', {1:true,2:{id:1}}, 'Editar categoría'],
  ['promoción por artículo', {7:true}, 'Buscar artículo'],
  ['promoción por categoría', {7:true,9:{alcance:'categoria',categoria_id:1,descuento_porcentaje:10,fecha_inicio:'2035-01-01',fecha_fin:'',activo:true},0:[{id:1,nombre:'Cuidado',activo:true}]}, 'Selecciona una categoría'],
  ['noticia nueva', {26:true}, 'Publicar noticia'],
  ['sede nueva', {17:true}, 'Guardar sede'],
  ['horario semanal', {20:true}, 'Guardar horario semanal'],
  ['bloqueo de agenda', {23:true}, 'Guardar bloqueo'],
])('Ajustes mantiene %s tras separar los formularios', (_, valores, esperado) => {
  expect(mostrar(Ajustes,valores)).toContain(esperado);
});

function buscarFondo(nodo) {
  if (!nodo) return null;
  if (Array.isArray(nodo)) return nodo.map(buscarFondo).find(Boolean);
  if (nodo.props?.className === 'modal-fondo') return nodo;
  return buscarFondo(nodo.props?.children);
}
test.each([
  ['detalle del servicio',Tienda,16,servicio,null],
  ['solicitud de cita',Tienda,14,true,false],
  ['confirmación de cita',Tienda,15,{id:88},null],
  ['carrito',Tienda,9,true,false],
  ['pedido',Tienda,10,true,false],
  ['confirmación del pedido',Tienda,11,{id:22},null],
  ['categoría',Ajustes,1,true,false],
  ['promoción',Ajustes,7,true,false],
  ['noticia',Ajustes,26,true,false],
  ['sede',Ajustes,17,true,false],
  ['horario',Ajustes,20,true,false],
  ['bloqueo',Ajustes,23,true,false],
])('el modal de %s se cierra con Escape o clic en fondo, no al escribir o pulsar dentro',(_,Componente,indice,valor,cierre)=>{
  estado.valores={[indice]:valor};
  const fondo=buscarFondo(Componente());
  expect(fondo).toBeTruthy();
  expect(fondo.props.children.props.role).toBe('dialog');
  expect(fondo.props.children.props['aria-modal']).toBe('true');
  const superficie={};
  fondo.props.onClick({target:{},currentTarget:superficie});
  fondo.props.onKeyDown({key:'Enter'});
  expect(estado.cambios[indice]).not.toHaveBeenCalled();
  fondo.props.onKeyDown({key:'Escape'});
  expect(estado.cambios[indice]).toHaveBeenCalledWith(cierre);
  estado.cambios[indice].mockClear();
  fondo.props.onClick({target:superficie,currentTarget:superficie});
  expect(estado.cambios[indice]).toHaveBeenCalledWith(cierre);
});
