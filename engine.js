/* ============================================================
   OBRA CONTROL — MOTOR DE DATOS Y CÁLCULO
   Versión extendida de OBRA FIRME: incluye TODA la funcionalidad
   original más órdenes de compra, flujo de caja, proveedores
   mejorados, contratos y calendario de pagos.
   Archivo independiente y sin dependencias.
   Expone window.ENGINE (navegador) y module.exports (Node, para pruebas).
   ============================================================ */
(function (global) {
  'use strict';

  /* ---------- utilidades numéricas exactas ---------- */
  // Todo el dinero se maneja redondeando a centavos en CADA operación
  // para evitar arrastre de error de punto flotante.
  const num = (v) => {
    const n = typeof v === 'number' ? v : parseFloat(String(v == null ? '' : v).replace(/,/g, ''));
    return isFinite(n) ? n : 0;
  };
  const r2 = (v) => Math.round((num(v) + Number.EPSILON) * 100) / 100;
  const pct = (parte, total) => (num(total) === 0 ? 0 : Math.round((num(parte) / num(total)) * 1000) / 10);

  const uid = (p) =>
    p + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  const hoy = () => new Date().toISOString().slice(0, 10);
  const mesDe = (fecha) => String(fecha || '').slice(0, 7); // YYYY-MM

  const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  const nombreMes = (ym) => {
    const [a, m] = String(ym).split('-');
    return (MESES[parseInt(m, 10) - 1] || '?') + ' ' + a;
  };

  // Suma N meses (puede ser negativo) a un 'YYYY-MM', devuelve 'YYYY-MM'.
  const sumarMeses = (ym, n) => {
    const [a, m] = String(ym).split('-').map((x) => parseInt(x, 10));
    const base = (a || 0) * 12 + ((m || 1) - 1) + num(n);
    const anio = Math.floor(base / 12);
    const mes = (base % 12 + 12) % 12;
    return anio + '-' + String(mes + 1).padStart(2, '0');
  };

  /* ---------- catálogos ---------- */
  const TIPOS_GASTO = [
    { id: 'material', label: 'Material' },
    { id: 'mano_obra', label: 'Mano de obra' },
    { id: 'equipo', label: 'Equipo / alquiler' },
    { id: 'transporte', label: 'Transporte' },
    { id: 'permiso', label: 'Permisos / trámites' },
    { id: 'otro', label: 'Otro' },
  ];

  const ICONOS = [
    'preliminares', 'obra_gris', 'estructura', 'techo', 'electrico', 'hidro',
    'acabados', 'pintura', 'carpinteria', 'herreria', 'mano_obra', 'imprevistos',
  ];

  const CATEGORIAS_BASE = [
    { nombre: 'Preliminares', icono: 'preliminares', fase: 'Fase 1 — Preparación' },
    { nombre: 'Obra gris', icono: 'obra_gris', fase: 'Fase 2 — Estructura' },
    { nombre: 'Estructura y concreto', icono: 'estructura', fase: 'Fase 2 — Estructura' },
    { nombre: 'Techos', icono: 'techo', fase: 'Fase 2 — Estructura' },
    { nombre: 'Eléctrico', icono: 'electrico', fase: 'Fase 3 — Instalaciones' },
    { nombre: 'Hidrosanitario', icono: 'hidro', fase: 'Fase 3 — Instalaciones' },
    { nombre: 'Acabados', icono: 'acabados', fase: 'Fase 4 — Acabados' },
    { nombre: 'Pintura', icono: 'pintura', fase: 'Fase 4 — Acabados' },
    { nombre: 'Carpintería', icono: 'carpinteria', fase: 'Fase 4 — Acabados' },
    { nombre: 'Herrería', icono: 'herreria', fase: 'Fase 4 — Acabados' },
    { nombre: 'Mano de obra general', icono: 'mano_obra', fase: 'Fase 5 — Cierre' },
    { nombre: 'Imprevistos', icono: 'imprevistos', fase: 'Fase 5 — Cierre' },
  ];

  const ESTADOS_PROYECTO = [
    { id: 'activo', label: 'Activo' },
    { id: 'pausado', label: 'Pausado' },
    { id: 'terminado', label: 'Terminado' },
  ];

  const FASES = [
    'Fase 1 — Preparación',
    'Fase 2 — Estructura',
    'Fase 3 — Instalaciones',
    'Fase 4 — Acabados',
    'Fase 5 — Cierre',
  ];

  // Catálogo de estados para órdenes de compra.
  const estadosOrden = [
    { id: 'borrador', label: 'Borrador', color: 'gris' },
    { id: 'aprobada', label: 'Aprobada', color: 'ambar' },
    { id: 'recibida', label: 'Recibida', color: 'mint' },
    { id: 'cancelada', label: 'Cancelada', color: 'rojo' },
  ];

  // Catálogo de estados para contratos.
  const estadosContrato = [
    { id: 'vigente', label: 'Vigente', color: 'ambar' },
    { id: 'completado', label: 'Completado', color: 'mint' },
    { id: 'cancelado', label: 'Cancelado', color: 'rojo' },
  ];

  /* ---------- esquema del estado ---------- */
  /*
    estado = {
      version, moneda,
      proyectoActivo: id | null,
      proyectos:    [{ id, nombre, ubicacion, responsable, inicio, fin, estado, notas }],
      categorias:   [{ id, proyectoId, nombre, icono, fase, presupuesto }],
      gastos:       [{ id, proyectoId, categoriaId, fecha, descripcion, proveedor,
                       tipo, cantidad, unidad, precioUnitario, monto, pagado, notas, creado }],
      licitaciones: [{ id, proyectoId, categoriaId, titulo, unidad, cantidad, notas,
                       pesos: { precio, calidad, tiempo, garantia },
                       ofertas: [{ id, proveedor, precioUnitario, total, dias,
                                   calidad, garantia, notas }],
                       adjudicadaA: ofertaId | null, creado }],
      proveedores:  [{ id, nombre, contacto, telefono, categorias, calificacion,
                       condicionesPago, tiempoEntregaPromedio, notas }],
      ordenes:      [{ id, proyectoId, categoriaId, numero, proveedor, fecha, fechaEntrega,
                       items: [{descripcion, cantidad, unidad, marca, precioUnitario, total}],
                       subtotal, impuesto, retencionIR, total, estado, notas, creado }],
      contratos:    [{ id, proyectoId, proveedor, titulo, montoContrato, anticipo, retencion,
                       fechaInicio, fechaFin, estado, avance, notas, creado }],
      pagos:        [{ id, proyectoId, tipo, metodo, referencia, monto, fecha,
                       proveedorId, trabajador, descripcion, notas, creado }]
    }
  */
  function estadoVacio() {
    return {
      version: 1,
      moneda: 'C$',
      proyectoActivo: null,
      proyectos: [],
      categorias: [],
      gastos: [],
      licitaciones: [],
      proveedores: [],
      ordenes: [],
      contratos: [],
      pagos: [],
    };
  }

  function nuevoProyecto(datos) {
    return Object.assign(
      {
        id: uid('pr'),
        nombre: 'Proyecto sin nombre',
        ubicacion: '',
        responsable: '',
        inicio: hoy(),
        fin: '',
        estado: 'activo',
        notas: '',
      },
      datos || {}
    );
  }

  function categoriasIniciales(proyectoId) {
    return CATEGORIAS_BASE.map((c) => ({
      id: uid('ct'),
      proyectoId,
      nombre: c.nombre,
      icono: c.icono,
      fase: c.fase,
      presupuesto: 0,
    }));
  }

  // Normaliza un gasto: el monto SIEMPRE se recalcula desde cantidad x precio
  // salvo que se marque montoManual.
  function normalizarGasto(g) {
    const cantidad = num(g.cantidad);
    const precioUnitario = r2(g.precioUnitario);
    const monto = g.montoManual ? r2(g.monto) : r2(cantidad * precioUnitario);
    const pagado = g.pagado !== false;
    // La fecha de vencimiento solo tiene sentido en facturas al crédito (no pagadas).
    // Si el gasto está pagado, se descarta para no dejar datos huérfanos.
    const fechaVencimiento = pagado ? '' : (g.fechaVencimiento || '');
    return Object.assign({}, g, {
      id: g.id || uid('gs'),
      fecha: g.fecha || hoy(),
      cantidad,
      precioUnitario,
      monto,
      pagado,
      fechaVencimiento,
      creado: g.creado || new Date().toISOString(),
    });
  }

  /* ============================================================
     PROVEEDORES MEJORADOS
     ============================================================ */

  // Normaliza un proveedor con los campos ampliados.
  function normalizarProveedor(p) {
    return Object.assign({}, p, {
      id: p.id || uid('pv'),
      nombre: p.nombre || 'Sin nombre',
      contacto: p.contacto || '',
      telefono: p.telefono || '',
      categorias: Array.isArray(p.categorias) ? p.categorias : [],
      calificacion: Math.max(1, Math.min(5, num(p.calificacion) || 3)),
      condicionesPago: p.condicionesPago || 'Contado',
      tiempoEntregaPromedio: num(p.tiempoEntregaPromedio),
      notas: p.notas || '',
      creado: p.creado || new Date().toISOString(),
    });
  }

  /* ============================================================
     ÓRDENES DE COMPRA
     ============================================================ */

  // Recalcula totales de línea, subtotal y total de una orden de compra.
  function normalizarOrden(o) {
    const items = (o.items || []).map((it) => {
      const cantidad = num(it.cantidad);
      const precioUnitario = r2(it.precioUnitario);
      const total = r2(cantidad * precioUnitario);
      return Object.assign({}, it, { cantidad, precioUnitario, total, marca: it.marca || '', unidad: it.unidad || 'Unidad' });
    });
    const subtotal = r2(items.reduce((s, it) => s + it.total, 0));
    const impuestoPct = r2(o.impuesto);
    const retencionIR = o.retencionIR ? r2(subtotal * 0.02) : 0;
    const impuesto = r2(subtotal * impuestoPct / 100);
    const total = r2(subtotal + impuesto - retencionIR);
    return Object.assign({}, o, {
      id: o.id || uid('oc'),
      numero: o.numero || ('OC-' + Date.now().toString().slice(-6)),
      fecha: o.fecha || hoy(),
      fechaEntrega: o.fechaEntrega || '',
      items,
      subtotal,
      impuesto: impuestoPct,
      retencionIR,
      total,
      estado: o.estado || 'borrador',
      notas: o.notas || '',
      creado: o.creado || new Date().toISOString(),
    });
  }

  /* ============================================================
     PAGOS (abonos, adelantos, anticipos)
     ============================================================ */
  const TIPOS_PAGO = [
    { id: 'abono', label: 'Abono' },
    { id: 'adelanto_material', label: 'Adelanto material' },
    { id: 'adelanto_mano_obra', label: 'Adelanto mano de obra' },
    { id: 'anticipo', label: 'Anticipo' },
    { id: 'liquidacion', label: 'Liquidación' },
  ];
  const METODOS_PAGO = [
    { id: 'efectivo', label: 'Efectivo' },
    { id: 'transferencia', label: 'Transferencia' },
    { id: 'cheque', label: 'Cheque' },
    { id: 'tarjeta', label: 'Tarjeta' },
    { id: 'otro', label: 'Otro' },
  ];

  function normalizarPago(p) {
    return {
      id: p.id || uid('pg'),
      proyectoId: p.proyectoId,
      tipo: p.tipo || 'abono',
      metodo: p.metodo || 'efectivo',
      referencia: p.referencia || '',
      contratoId: p.contratoId || '',
      monto: r2(p.monto),
      fecha: p.fecha || hoy(),
      proveedorId: p.proveedorId || '',
      trabajador: p.trabajador || '',
      descripcion: p.descripcion || '',
      notas: p.notas || '',
      creado: p.creado || new Date().toISOString(),
    };
  }

  function historialPagos(pagos, filtro) {
    let lista = pagos;
    if (filtro.proyectoId) lista = lista.filter((p) => p.proyectoId === filtro.proyectoId);
    if (filtro.tipo) lista = lista.filter((p) => p.tipo === filtro.tipo);
    if (filtro.proveedorId) lista = lista.filter((p) => p.proveedorId === filtro.proveedorId);
    if (filtro.trabajador) lista = lista.filter((p) => p.trabajador === filtro.trabajador);
    return lista.sort((a, b) => a.fecha < b.fecha ? 1 : -1);
  }

  function resumenPagosContrato(pagos, contratoId) {
    const propios = pagos.filter((p) => p.contratoId === contratoId);
    return {
      total: r2(propios.reduce((s, p) => s + num(p.monto), 0)),
      cantidad: propios.length,
      pagos: propios.sort((a, b) => a.fecha < b.fecha ? 1 : -1),
    };
  }

  function resumenPagosProveedor(pagos, proveedorId) {
    const propios = pagos.filter((p) => p.proveedorId === proveedorId);
    return {
      total: r2(propios.reduce((s, p) => s + num(p.monto), 0)),
      cantidad: propios.length,
      pagos: propios.sort((a, b) => a.fecha < b.fecha ? 1 : -1),
    };
  }

  function resumenPagosTrabajador(pagos, trabajador) {
    const propios = pagos.filter((p) => p.trabajador === trabajador);
    return {
      total: r2(propios.reduce((s, p) => s + num(p.monto), 0)),
      cantidad: propios.length,
      pagos: propios.sort((a, b) => a.fecha < b.fecha ? 1 : -1),
    };
  }

  /* ============================================================
     CONTRATOS
     ============================================================ */

  function normalizarContrato(c) {
    const montoContrato = r2(c.montoContrato);
    const anticipo = r2(c.anticipo);
    const retencion = r2(c.retencion);
    const avance = Math.max(0, Math.min(100, num(c.avance)));
    return Object.assign({}, c, {
      id: c.id || uid('ct2'),
      titulo: c.titulo || 'Contrato sin título',
      proveedor: c.proveedor || '',
      montoContrato,
      anticipo,
      retencion,
      fechaInicio: c.fechaInicio || hoy(),
      fechaFin: c.fechaFin || '',
      estado: c.estado || 'vigente',
      avance,
      notas: c.notas || '',
      creado: c.creado || new Date().toISOString(),
    });
  }

  // Compara lo pactado en el contrato contra los gastos reales asociados al mismo
  // proveedor dentro del proyecto (proxy simple de "varianza de contrato").
  function varianzaContrato(contrato, gastos) {
    const relacionados = (gastos || []).filter(
      (g) => g.proyectoId === contrato.proyectoId && g.proveedor === contrato.proveedor
    );
    const gastado = r2(relacionados.reduce((s, g) => s + num(g.monto), 0));
    const montoContrato = r2(contrato.montoContrato);
    const avanceEsperado = r2((montoContrato * num(contrato.avance)) / 100);
    const saldo = r2(montoContrato - gastado);
    const varianza = r2(gastado - avanceEsperado);
    return {
      contratoId: contrato.id,
      titulo: contrato.titulo,
      montoContrato,
      gastado,
      saldo,
      avance: contrato.avance,
      avanceEsperado,
      varianza, // positivo = se ha gastado más de lo que el % de avance sugiere
      movimientos: relacionados.length,
      estado: clasificar(montoContrato, gastado),
    };
  }

  /* ============================================================
     MOTOR DE VARIANZA PRESUPUESTARIA
     ============================================================ */

  const ESTADOS = {
    sano: { id: 'sano', label: 'En rango', color: 'mint' },
    alerta: { id: 'alerta', label: 'Cerca del límite', color: 'amber' },
    excedido: { id: 'excedido', label: 'Sobrecosto', color: 'rojo' },
    sinPresupuesto: { id: 'sinPresupuesto', label: 'Sin presupuesto', color: 'gris' },
  };

  function clasificar(presupuesto, gastado) {
    const pres = r2(presupuesto);
    const gas = r2(gastado);
    if (pres <= 0) return gas > 0 ? ESTADOS.excedido : ESTADOS.sinPresupuesto;
    // Se compara el monto real, no el porcentaje redondeado: un centavo de más
    // ya es sobrecosto aunque el porcentaje se muestre como 100%.
    if (gas > pres) return ESTADOS.excedido;
    if (gas / pres >= 0.85) return ESTADOS.alerta;
    return ESTADOS.sano;
  }

  // Varianza de UNA categoría
  function varianzaCategoria(categoria, gastos) {
    const propios = gastos.filter((g) => g.categoriaId === categoria.id);
    const gastado = r2(propios.reduce((s, g) => s + num(g.monto), 0));
    const pagado = r2(propios.filter((g) => g.pagado).reduce((s, g) => s + num(g.monto), 0));
    const presupuesto = r2(categoria.presupuesto);
    const saldo = r2(presupuesto - gastado); // + = ahorro, - = sobrecosto
    return {
      categoriaId: categoria.id,
      nombre: categoria.nombre,
      icono: categoria.icono,
      fase: categoria.fase,
      presupuesto,
      gastado,
      pagado,
      porPagar: r2(gastado - pagado),
      saldo,
      ahorro: saldo > 0 ? saldo : 0,
      sobrecosto: saldo < 0 ? r2(-saldo) : 0,
      ejecucion: pct(gastado, presupuesto),
      movimientos: propios.length,
      estado: clasificar(presupuesto, gastado),
    };
  }

  // Varianza de TODO el proyecto
  function varianzaProyecto(proyectoId, categorias, gastos) {
    const cats = categorias.filter((c) => c.proyectoId === proyectoId);
    const gs = gastos.filter((g) => g.proyectoId === proyectoId);
    const detalle = cats.map((c) => varianzaCategoria(c, gs));

    const presupuesto = r2(detalle.reduce((s, d) => s + d.presupuesto, 0));
    const gastado = r2(detalle.reduce((s, d) => s + d.gastado, 0));
    const pagado = r2(detalle.reduce((s, d) => s + d.pagado, 0));

    // Gastos huérfanos (categoría borrada) — se cuentan igual, nunca se pierde dinero.
    const idsCat = cats.map((c) => c.id);
    const huerfanos = gs.filter((g) => idsCat.indexOf(g.categoriaId) === -1);
    const montoHuerfano = r2(huerfanos.reduce((s, g) => s + num(g.monto), 0));

    const gastadoTotal = r2(gastado + montoHuerfano);
    const saldo = r2(presupuesto - gastadoTotal);
    const pagadoTotal = r2(
      pagado + huerfanos.filter((g) => g.pagado).reduce((s, g) => s + num(g.monto), 0)
    );

    return {
      proyectoId,
      presupuesto,
      gastado: gastadoTotal,
      pagado: pagadoTotal,
      porPagar: r2(gastadoTotal - pagadoTotal),
      saldo,
      ahorro: saldo > 0 ? saldo : 0,
      sobrecosto: saldo < 0 ? r2(-saldo) : 0,
      ejecucion: pct(gastadoTotal, presupuesto),
      estado: clasificar(presupuesto, gastadoTotal),
      movimientos: gs.length,
      sinClasificar: montoHuerfano,
      detalle: detalle.sort((a, b) => b.gastado - a.gastado),
    };
  }

  /* ============================================================
     MOTOR DE COMPARACIÓN DE OFERTAS
     Criterios: precio, calidad (1-5), tiempo de entrega (días), garantía (meses).
     Cada criterio se normaliza a 0..1 y se pondera. Los criterios sin datos
     útiles se descartan y sus pesos se redistribuyen automáticamente.
     ============================================================ */

  const PESOS_DEFECTO = { precio: 50, calidad: 25, tiempo: 15, garantia: 10 };

  function totalOferta(oferta, cantOLic) {
    if (num(oferta.total) > 0) return r2(oferta.total);
    var articulos = (typeof cantOLic === 'object') ? (cantOLic.articulos || []) : [];
    if (articulos.length > 0) {
      var precios = oferta.precios || [];
      return r2(articulos.reduce(function(s, art) {
        var p = precios.find(function(pr) { return pr.articuloId === art.id; });
        return s + num(p ? p.precioUnitario : 0) * num(art.cantidad);
      }, 0));
    }
    var cant = num(typeof cantOLic === 'object' ? cantOLic.cantidad : cantOLic);
    return r2(num(oferta.precioUnitario) * (cant > 0 ? cant : 1));
  }

  function compararOfertas(licitacion) {
    const pesos = Object.assign({}, PESOS_DEFECTO, licitacion.pesos || {});
    const cantidad = num(licitacion.cantidad);
    const tieneArticulos = (licitacion.articulos || []).length > 0;
    const base = (licitacion.ofertas || []).map((o) => {
      const total = totalOferta(o, licitacion);
      return {
        id: o.id,
        proveedor: o.proveedor || 'Sin nombre',
        precioUnitario: r2(
          num(o.precioUnitario) > 0 ? o.precioUnitario : cantidad > 0 ? total / cantidad : total
        ),
        total,
        dias: num(o.dias),
        calidad: num(o.calidad),
        garantia: num(o.garantia),
        notas: o.notas || '',
      };
    });

    const validas = base.filter((o) => o.total > 0);
    if (validas.length === 0) {
      return { ofertas: base.map((o) => Object.assign({}, o, { puntaje: 0 })), resumen: null };
    }

    const totales = validas.map((o) => o.total);
    const minTotal = Math.min.apply(null, totales);
    const maxTotal = Math.max.apply(null, totales);

    const conDias = validas.filter((o) => o.dias > 0).map((o) => o.dias);
    const minDias = conDias.length ? Math.min.apply(null, conDias) : 0;
    const usaTiempo = conDias.length > 0;

    const usaCalidad = validas.some((o) => o.calidad > 0);
    const garantias = validas.map((o) => o.garantia);
    const maxGarantia = Math.max.apply(null, garantias);
    const usaGarantia = maxGarantia > 0;

    // Redistribución de pesos: solo cuentan los criterios con datos.
    const activos = {
      precio: num(pesos.precio),
      calidad: usaCalidad ? num(pesos.calidad) : 0,
      tiempo: usaTiempo ? num(pesos.tiempo) : 0,
      garantia: usaGarantia ? num(pesos.garantia) : 0,
    };
    const sumaPesos = activos.precio + activos.calidad + activos.tiempo + activos.garantia;
    const w = sumaPesos > 0
      ? {
          precio: activos.precio / sumaPesos,
          calidad: activos.calidad / sumaPesos,
          tiempo: activos.tiempo / sumaPesos,
          garantia: activos.garantia / sumaPesos,
        }
      : { precio: 1, calidad: 0, tiempo: 0, garantia: 0 };

    const evaluadas = base.map((o) => {
      if (o.total <= 0) {
        return Object.assign({}, o, {
          puntaje: 0, sPrecio: 0, sCalidad: 0, sTiempo: 0, sGarantia: 0,
          diferencia: 0, diferenciaPct: 0, incompleta: true,
        });
      }
      const sPrecio = minTotal / o.total;                       // más barato = 1
      const sCalidad = usaCalidad ? Math.min(o.calidad, 5) / 5 : 0;
      const sTiempo = usaTiempo ? (o.dias > 0 ? minDias / o.dias : 0) : 0;
      const sGarantia = usaGarantia ? o.garantia / maxGarantia : 0;
      const puntaje =
        100 * (w.precio * sPrecio + w.calidad * sCalidad + w.tiempo * sTiempo + w.garantia * sGarantia);
      return Object.assign({}, o, {
        sPrecio, sCalidad, sTiempo, sGarantia,
        puntaje: Math.round(puntaje * 10) / 10,
        diferencia: r2(o.total - minTotal),
        diferenciaPct: minTotal > 0 ? Math.round(((o.total - minTotal) / minTotal) * 1000) / 10 : 0,
        incompleta: false,
      });
    });

    const economica = evaluadas.reduce((a, b) => (!a || (b.total > 0 && b.total < a.total) ? b : a), null);
    const mejorValor = evaluadas.reduce((a, b) => (!a || b.puntaje > a.puntaje ? b : a), null);
    const masRapida = usaTiempo
      ? evaluadas.filter((o) => o.dias > 0).reduce((a, b) => (!a || b.dias < a.dias ? b : a), null)
      : null;

    const marcadas = evaluadas
      .map((o) =>
        Object.assign({}, o, {
          esEconomica: !!economica && o.id === economica.id,
          esMejorValor: !!mejorValor && o.id === mejorValor.id,
          esMasRapida: !!masRapida && o.id === masRapida.id,
          esAdjudicada: licitacion.adjudicadaA === o.id,
        })
      )
      .sort((a, b) => b.puntaje - a.puntaje);

    const adjudicada = marcadas.filter((o) => o.esAdjudicada)[0] || null;

    return {
      ofertas: marcadas,
      resumen: {
        cantidad: validas.length,
        minTotal,
        maxTotal,
        rango: r2(maxTotal - minTotal),
        rangoPct: minTotal > 0 ? Math.round(((maxTotal - minTotal) / minTotal) * 1000) / 10 : 0,
        promedio: r2(totales.reduce((s, t) => s + t, 0) / totales.length),
        economica,
        mejorValor,
        masRapida,
        adjudicada,
        // Ahorro real si se adjudica la más barata frente a la más cara.
        ahorroPotencial: r2(maxTotal - minTotal),
        // Sobreprecio de la adjudicada frente a la más barata (0 si eligió la más barata).
        sobreprecioAdjudicada: adjudicada ? r2(adjudicada.total - minTotal) : 0,
        criteriosUsados: {
          precio: true, calidad: usaCalidad, tiempo: usaTiempo, garantia: usaGarantia,
        },
        pesosEfectivos: {
          precio: Math.round(w.precio * 100),
          calidad: Math.round(w.calidad * 100),
          tiempo: Math.round(w.tiempo * 100),
          garantia: Math.round(w.garantia * 100),
        },
      },
    };
  }

  /* ============================================================
     REPORTES INTELIGENTES
     ============================================================ */

  function reporteMensual(proyectoId, categorias, gastos) {
    const gs = gastos.filter((g) => g.proyectoId === proyectoId);
    const mapaCat = {};
    categorias.forEach((c) => (mapaCat[c.id] = c));

    const meses = {};
    gs.forEach((g) => {
      const m = mesDe(g.fecha);
      if (!m) return;
      if (!meses[m]) meses[m] = { mes: m, etiqueta: nombreMes(m), total: 0, movimientos: 0, porTipo: {}, porCategoria: {} };
      const b = meses[m];
      b.total = r2(b.total + num(g.monto));
      b.movimientos += 1;
      const t = g.tipo || 'otro';
      b.porTipo[t] = r2((b.porTipo[t] || 0) + num(g.monto));
      const cn = (mapaCat[g.categoriaId] || {}).nombre || 'Sin categoría';
      b.porCategoria[cn] = r2((b.porCategoria[cn] || 0) + num(g.monto));
    });

    const lista = Object.keys(meses).sort().map((k) => {
      const b = meses[k];
      const cats = Object.keys(b.porCategoria).map((n) => ({ nombre: n, monto: b.porCategoria[n] }));
      cats.sort((a, c) => c.monto - a.monto);
      return Object.assign({}, b, { topCategoria: cats[0] || null, categorias: cats });
    });

    // Variación mes a mes
    lista.forEach((m, i) => {
      const prev = lista[i - 1];
      m.variacion = prev ? r2(m.total - prev.total) : 0;
      m.variacionPct = prev && prev.total > 0 ? Math.round(((m.total - prev.total) / prev.total) * 1000) / 10 : 0;
    });

    return lista;
  }

  function reportePorFase(proyectoId, categorias, gastos) {
    const v = varianzaProyecto(proyectoId, categorias, gastos);
    const fases = {};
    v.detalle.forEach((d) => {
      const f = d.fase || 'Sin fase';
      if (!fases[f]) fases[f] = { fase: f, presupuesto: 0, gastado: 0, categorias: [] };
      fases[f].presupuesto = r2(fases[f].presupuesto + d.presupuesto);
      fases[f].gastado = r2(fases[f].gastado + d.gastado);
      fases[f].categorias.push(d);
    });
    const orden = (f) => {
      const i = FASES.indexOf(f);
      return i === -1 ? 99 : i;
    };
    return Object.keys(fases)
      .sort((a, b) => orden(a) - orden(b))
      .map((k) => {
        const f = fases[k];
        const saldo = r2(f.presupuesto - f.gastado);
        return Object.assign(f, {
          saldo,
          ahorro: saldo > 0 ? saldo : 0,
          sobrecosto: saldo < 0 ? r2(-saldo) : 0,
          ejecucion: pct(f.gastado, f.presupuesto),
          estado: clasificar(f.presupuesto, f.gastado),
        });
      });
  }

  // Frases de alerta generadas a partir de los números (sin adivinar nada).
  function alertas(proyectoId, categorias, gastos, licitaciones) {
    const v = varianzaProyecto(proyectoId, categorias, gastos);
    const out = [];

    if (v.presupuesto === 0) {
      out.push({ nivel: 'info', texto: 'Aún no hay presupuesto asignado. Define montos por categoría para activar el control de varianza.' });
    }
    if (v.sobrecosto > 0) {
      out.push({ nivel: 'alto', texto: 'El proyecto va ' + v.sobrecosto.toFixed(2) + ' por encima del presupuesto total (' + v.ejecucion + '% ejecutado).' });
    }
    v.detalle.filter((d) => d.sobrecosto > 0).forEach((d) => {
      out.push({ nivel: 'alto', texto: d.nombre + ': sobrecosto de ' + d.sobrecosto.toFixed(2) + ' (' + d.ejecucion + '% del presupuesto).' });
    });
    v.detalle.filter((d) => d.estado.id === 'alerta').forEach((d) => {
      out.push({ nivel: 'medio', texto: d.nombre + ' va en ' + d.ejecucion + '%. Quedan ' + d.saldo.toFixed(2) + ' disponibles.' });
    });
    if (v.porPagar > 0) {
      out.push({ nivel: 'medio', texto: 'Hay ' + v.porPagar.toFixed(2) + ' registrados como pendientes de pago.' });
    }
    if (v.sinClasificar > 0) {
      out.push({ nivel: 'medio', texto: 'Hay ' + v.sinClasificar.toFixed(2) + ' en gastos sin categoría asignada.' });
    }

    (licitaciones || []).filter((l) => l.proyectoId === proyectoId).forEach((l) => {
      const c = compararOfertas(l);
      if (!c.resumen) return;
      if (!l.adjudicadaA && c.resumen.cantidad >= 2) {
        out.push({ nivel: 'info', texto: '"' + l.titulo + '" tiene ' + c.resumen.cantidad + ' ofertas sin adjudicar. Diferencia entre la más cara y la más barata: ' + c.resumen.rango.toFixed(2) + '.' });
      }
      if (c.resumen.sobreprecioAdjudicada > 0) {
        out.push({ nivel: 'medio', texto: 'En "' + l.titulo + '" se adjudicó una oferta ' + c.resumen.sobreprecioAdjudicada.toFixed(2) + ' más cara que la mínima.' });
      }
    });

    if (out.length === 0) {
      out.push({ nivel: 'ok', texto: 'Sin desviaciones. Todas las categorías están dentro del presupuesto.' });
    }
    return out;
  }

  /* ============================================================
     VENCIMIENTOS DE FACTURAS AL CRÉDITO
     ============================================================ */

  // Días de calendario entre hoy y una fecha 'YYYY-MM-DD'.
  // Negativo = ya venció; 0 = vence hoy; positivo = días restantes.
  function diasHasta(fecha) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(fecha || ''))) return null;
    const hoyStr = hoy();
    const a = new Date(hoyStr + 'T00:00:00');
    const b = new Date(fecha + 'T00:00:00');
    return Math.round((b.getTime() - a.getTime()) / 86400000);
  }

  // Gastos no pagados con fecha de vencimiento dentro del horizonte (incluye ya vencidos).
  // Ordenados por fecha de vencimiento ascendente (lo más urgente primero).
  function gastosProximosAVencer(proyectoId, gastos, diasHorizonte) {
    const horizonte = diasHorizonte == null ? 7 : num(diasHorizonte);
    return (gastos || [])
      .filter((g) => g.proyectoId === proyectoId && g.pagado === false && g.fechaVencimiento)
      .map((g) => ({ gasto: g, dias: diasHasta(g.fechaVencimiento) }))
      .filter((x) => x.dias !== null && x.dias <= horizonte)
      .sort((a, b) => (a.gasto.fechaVencimiento < b.gasto.fechaVencimiento ? -1 : a.gasto.fechaVencimiento > b.gasto.fechaVencimiento ? 1 : 0));
  }

  /* ============================================================
     CARTERA: VARIOS PROYECTOS A LA VEZ
     ============================================================ */

  // Resumen consolidado de todos los proyectos (o de los que coincidan con el filtro).
  function resumenCartera(estado, filtro) {
    const proyectos = (estado.proyectos || []).filter(
      (p) => !filtro || filtro === 'todos' || (p.estado || 'activo') === filtro
    );

    const filas = proyectos.map((p) => {
      const v = varianzaProyecto(p.id, estado.categorias, estado.gastos);
      const gs = (estado.gastos || []).filter((g) => g.proyectoId === p.id);
      const fechas = gs.map((g) => g.fecha).filter(Boolean).sort();
      const lics = (estado.licitaciones || []).filter((l) => l.proyectoId === p.id);
      const pendientes = lics.filter((l) => !l.adjudicadaA && (l.ofertas || []).length > 0);
      // Cuánto se puede ahorrar todavía si se adjudica la oferta más barata de cada comparativo abierto.
      const ahorroEnMesa = r2(
        pendientes.reduce((s, l) => {
          const c = compararOfertas(l);
          return s + (c.resumen ? c.resumen.rango : 0);
        }, 0)
      );
      return {
        proyecto: p,
        v,
        ultima: fechas.length ? fechas[fechas.length - 1] : '',
        categorias: (estado.categorias || []).filter((c) => c.proyectoId === p.id).length,
        licitacionesPendientes: pendientes.length,
        ahorroEnMesa,
      };
    });

    // Los que están por encima del presupuesto se ven primero.
    const rango = (f) => (f.v.estado.id === 'excedido' ? 0 : f.v.estado.id === 'alerta' ? 1 : 2);
    filas.sort((a, b) => rango(a) - rango(b) || b.v.gastado - a.v.gastado);

    const presupuesto = r2(filas.reduce((s, f) => s + f.v.presupuesto, 0));
    const gastado = r2(filas.reduce((s, f) => s + f.v.gastado, 0));
    const porPagar = r2(filas.reduce((s, f) => s + f.v.porPagar, 0));
    const saldo = r2(presupuesto - gastado);

    return {
      filas,
      totales: {
        proyectos: filas.length,
        presupuesto,
        gastado,
        porPagar,
        saldo,
        ahorro: saldo > 0 ? saldo : 0,
        sobrecosto: saldo < 0 ? r2(-saldo) : 0,
        ejecucion: pct(gastado, presupuesto),
        estado: clasificar(presupuesto, gastado),
        excedidos: filas.filter((f) => f.v.estado.id === 'excedido').length,
        enAlerta: filas.filter((f) => f.v.estado.id === 'alerta').length,
        movimientos: filas.reduce((s, f) => s + f.v.movimientos, 0),
        ahorroEnMesa: r2(filas.reduce((s, f) => s + f.ahorroEnMesa, 0)),
        comparativosPendientes: filas.reduce((s, f) => s + f.licitacionesPendientes, 0),
      },
    };
  }

  // Copia un proyecto con su estructura de categorías y presupuestos.
  // Los gastos se copian solo si se piden; los comparativos se copian sin adjudicar.
  function clonarProyecto(estado, proyectoId, nombre, incluirGastos) {
    const orig = (estado.proyectos || []).filter((p) => p.id === proyectoId)[0];
    if (!orig) return null;

    const p = nuevoProyecto(
      Object.assign({}, orig, {
        id: uid('pr'),
        nombre: nombre || orig.nombre + ' (copia)',
        inicio: hoy(),
        fin: '',
        estado: 'activo',
      })
    );

    const mapa = {};
    const categorias = (estado.categorias || [])
      .filter((c) => c.proyectoId === proyectoId)
      .map((c) => {
        const nid = uid('ct');
        mapa[c.id] = nid;
        return Object.assign({}, c, { id: nid, proyectoId: p.id });
      });

    const gastos = incluirGastos
      ? (estado.gastos || [])
          .filter((g) => g.proyectoId === proyectoId)
          .map((g) =>
            normalizarGasto(
              Object.assign({}, g, {
                id: uid('gs'),
                proyectoId: p.id,
                categoriaId: mapa[g.categoriaId] || '',
                creado: new Date().toISOString(),
              })
            )
          )
      : [];

    const licitaciones = (estado.licitaciones || [])
      .filter((l) => l.proyectoId === proyectoId)
      .map((l) =>
        Object.assign({}, l, {
          id: uid('li'),
          proyectoId: p.id,
          categoriaId: mapa[l.categoriaId] || '',
          adjudicadaA: null,
          creado: new Date().toISOString(),
          ofertas: (l.ofertas || []).map((o) => Object.assign({}, o, { id: uid('of') })),
        })
      );

    return { proyecto: p, categorias, gastos, licitaciones };
  }

  // Ubicaciones ya usadas en algún proyecto, para autocompletar sin repetir texto
  // ("Managua" vs "managua" vs "MANAGUA" quedarían como cosas distintas si no
  // se sugiere la que ya existe).
  function ubicacionesUsadas(estado) {
    const set = new Set();
    (estado.proyectos || []).forEach((p) => {
      const u = String(p.ubicacion || '').trim();
      if (u) set.add(u);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'es'));
  }

  // Cartera agrupada por ubicación, con subtotal de presupuesto/gasto por grupo.
  function resumenPorUbicacion(estado, filtroEstado) {
    const cartera = resumenCartera(estado, filtroEstado);
    const grupos = {};
    cartera.filas.forEach((f) => {
      const clave = String(f.proyecto.ubicacion || '').trim() || 'Sin ubicación';
      if (!grupos[clave]) grupos[clave] = { ubicacion: clave, filas: [], presupuesto: 0, gastado: 0 };
      grupos[clave].filas.push(f);
      grupos[clave].presupuesto = r2(grupos[clave].presupuesto + f.v.presupuesto);
      grupos[clave].gastado = r2(grupos[clave].gastado + f.v.gastado);
    });

    const lista = Object.keys(grupos).map((k) => {
      const g = grupos[k];
      const saldo = r2(g.presupuesto - g.gastado);
      return Object.assign(g, {
        proyectos: g.filas.length,
        saldo,
        ahorro: saldo > 0 ? saldo : 0,
        sobrecosto: saldo < 0 ? r2(-saldo) : 0,
        ejecucion: pct(g.gastado, g.presupuesto),
        estado: clasificar(g.presupuesto, g.gastado),
      });
    });

    lista.sort((a, b) => {
      if (a.ubicacion === 'Sin ubicación') return 1;
      if (b.ubicacion === 'Sin ubicación') return -1;
      return a.ubicacion.localeCompare(b.ubicacion, 'es');
    });

    return { grupos: lista, totales: cartera.totales };
  }

  /* ============================================================
     FLUJO DE CAJA
     ============================================================ */

  // Flujo mensual: por cada mes, entradas (informativo — no se registran ingresos
  // en el modelo original, así que "entradas" se deja en 0 salvo que se extienda
  // más adelante), salidas (gastos pagados) y órdenes recibidas/pagadas, con saldo
  // corriente acumulado (negativo del gasto acumulado, ya que no hay ingresos modelados).
  function flujoMensual(proyectoId, gastos, ordenes) {
    const gs = (gastos || []).filter((g) => g.proyectoId === proyectoId);
    const ocs = (ordenes || []).filter((o) => o.proyectoId === proyectoId && o.estado !== 'cancelada');

    const meses = {};
    const bucket = (m) => {
      if (!meses[m]) meses[m] = { mes: m, etiqueta: nombreMes(m), entradas: 0, salidas: 0, ordenes: 0, neto: 0 };
      return meses[m];
    };

    gs.forEach((g) => {
      const m = mesDe(g.fecha);
      if (!m) return;
      const b = bucket(m);
      b.salidas = r2(b.salidas + num(g.monto));
    });

    ocs.forEach((o) => {
      const m = mesDe(o.fecha);
      if (!m) return;
      const b = bucket(m);
      b.ordenes = r2(b.ordenes + num(o.total));
    });

    const lista = Object.keys(meses).sort().map((k) => meses[k]);
    let saldo = 0;
    lista.forEach((m) => {
      m.neto = r2(m.entradas - m.salidas);
      saldo = r2(saldo + m.neto);
      m.saldoAcumulado = saldo;
    });
    return lista;
  }

  // Proyección de flujo futuro basada en órdenes pendientes (aprobadas, no recibidas)
  // y el patrón de gasto promedio de los últimos meses reales.
  function proyeccionFlujo(proyectoId, gastos, ordenes, mesesFuturo) {
    const nMeses = Math.max(1, num(mesesFuturo) || 3);
    const historico = flujoMensual(proyectoId, gastos, ordenes);
    const ultimosReales = historico.slice(-3);
    const promedioSalidas = ultimosReales.length
      ? r2(ultimosReales.reduce((s, m) => s + m.salidas, 0) / ultimosReales.length)
      : 0;

    const mesActual = mesDe(hoy());
    const pendientes = (ordenes || []).filter(
      (o) => o.proyectoId === proyectoId && (o.estado === 'aprobada' || o.estado === 'borrador')
    );

    let saldo = historico.length ? historico[historico.length - 1].saldoAcumulado : 0;
    const out = [];
    for (let i = 1; i <= nMeses; i++) {
      const m = sumarMeses(mesActual, i);
      // Órdenes pendientes cuya fecha de entrega cae en este mes futuro se suman como salida esperada.
      const ordenesDelMes = pendientes.filter((o) => mesDe(o.fechaEntrega || o.fecha) === m);
      const salidaOrdenes = r2(ordenesDelMes.reduce((s, o) => s + num(o.total), 0));
      const salidaEstimada = r2(promedioSalidas + salidaOrdenes);
      const neto = r2(-salidaEstimada);
      saldo = r2(saldo + neto);
      out.push({
        mes: m,
        etiqueta: nombreMes(m),
        salidaEstimada,
        salidaBase: promedioSalidas,
        salidaOrdenes,
        ordenesEsperadas: ordenesDelMes.length,
        neto,
        saldoProyectado: saldo,
      });
    }
    return out;
  }

  /* ============================================================
     PROVEEDORES: HISTORIAL Y RANKING
     ============================================================ */

  // Historial de compras con un proveedor a través de gastos, licitaciones adjudicadas y órdenes.
  function historialProveedor(proveedorNombre, gastos, licitaciones, ordenes) {
    const nombre = String(proveedorNombre || '').trim();
    const gs = (gastos || []).filter((g) => (g.proveedor || '').trim() === nombre);
    const ocs = (ordenes || []).filter((o) => (o.proveedor || '').trim() === nombre);
    const licsGanadas = (licitaciones || []).filter((l) => {
      if (!l.adjudicadaA) return false;
      const of = (l.ofertas || []).filter((o) => o.id === l.adjudicadaA)[0];
      return of && (of.proveedor || '').trim() === nombre;
    });

    const totalGastos = r2(gs.reduce((s, g) => s + num(g.monto), 0));
    const totalOrdenes = r2(ocs.reduce((s, o) => s + num(o.total), 0));
    const totalLicitaciones = r2(
      licsGanadas.reduce((s, l) => {
        const of = (l.ofertas || []).filter((o) => o.id === l.adjudicadaA)[0];
        return s + (of ? totalOferta(of, l) : 0);
      }, 0)
    );

    const totalGastado = r2(totalGastos + totalOrdenes);
    const movimientos = gs.length + ocs.length;
    const promedioOrden = movimientos > 0 ? r2(totalGastado / movimientos) : 0;

    return {
      proveedor: nombre,
      gastos: gs,
      ordenes: ocs,
      licitacionesGanadas: licsGanadas,
      totalGastos,
      totalOrdenes,
      totalLicitaciones,
      totalGastado,
      movimientos,
      promedioOrden,
    };
  }

  // Ranking de proveedores registrados por total gastado (gastos + órdenes), filtrable por estado (activo/etc no aplica aquí, se deja por si acaso).
  function rankingProveedores(estado) {
    const proveedores = (estado.proveedores || []).map((p) => normalizarProveedor(p));
    const filas = proveedores.map((p) => {
      const h = historialProveedor(p.nombre, estado.gastos, estado.licitaciones, estado.ordenes);
      return Object.assign({ proveedor: p }, h);
    });
    filas.sort((a, b) => b.totalGastado - a.totalGastado);
    return filas;
  }

  /* ============================================================
     CALENDARIO DE PAGOS
     ============================================================ */

  // Eventos de pago (gastos al crédito con vencimiento, órdenes de compra con
  // fecha de entrega pendiente de pago) que caen dentro de un mes 'YYYY-MM'.
  function calendarioPagos(proyectoId, gastos, ordenes, contratos, mes) {
    const m = mes || mesDe(hoy());
    const out = [];

    (gastos || [])
      .filter((g) => g.proyectoId === proyectoId && g.pagado === false && g.fechaVencimiento && mesDe(g.fechaVencimiento) === m)
      .forEach((g) => {
        out.push({
          tipo: 'gasto',
          fecha: g.fechaVencimiento,
          descripcion: g.descripcion || 'Gasto',
          proveedor: g.proveedor || '',
          monto: num(g.monto),
          referencia: g.id,
        });
      });

    (ordenes || [])
      .filter((o) => o.proyectoId === proyectoId && (o.estado === 'aprobada' || o.estado === 'recibida') && o.fechaEntrega && mesDe(o.fechaEntrega) === m)
      .forEach((o) => {
        out.push({
          tipo: 'orden',
          fecha: o.fechaEntrega,
          descripcion: 'Orden ' + o.numero,
          proveedor: o.proveedor || '',
          monto: num(o.total),
          referencia: o.id,
        });
      });

    (contratos || [])
      .filter((c) => c.proyectoId === proyectoId && c.estado === 'vigente' && c.fechaFin && mesDe(c.fechaFin) === m)
      .forEach((c) => {
        const saldoPendiente = r2(num(c.montoContrato) - num(c.anticipo));
        out.push({
          tipo: 'contrato',
          fecha: c.fechaFin,
          descripcion: 'Cierre de contrato: ' + c.titulo,
          proveedor: c.proveedor || '',
          monto: saldoPendiente,
          referencia: c.id,
        });
      });

    out.sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0));
    const total = r2(out.reduce((s, e) => s + num(e.monto), 0));
    return { mes: m, etiqueta: nombreMes(m), eventos: out, total };
  }

  // Pagos que vencen dentro de los próximos N días (incluye vencidos), combinando
  // gastos al crédito y entregas de órdenes de compra pendientes.
  function proximosPagos(proyectoId, gastos, ordenes, dias) {
    const horizonte = dias == null ? 15 : num(dias);
    const out = [];

    gastosProximosAVencer(proyectoId, gastos, horizonte).forEach((x) => {
      out.push({
        tipo: 'gasto',
        fecha: x.gasto.fechaVencimiento,
        dias: x.dias,
        descripcion: x.gasto.descripcion || 'Gasto',
        proveedor: x.gasto.proveedor || '',
        monto: num(x.gasto.monto),
        referencia: x.gasto.id,
      });
    });

    (ordenes || [])
      .filter((o) => o.proyectoId === proyectoId && o.estado === 'aprobada' && o.fechaEntrega)
      .map((o) => ({ o, d: diasHasta(o.fechaEntrega) }))
      .filter((x) => x.d !== null && x.d <= horizonte)
      .forEach((x) => {
        out.push({
          tipo: 'orden',
          fecha: x.o.fechaEntrega,
          dias: x.d,
          descripcion: 'Orden ' + x.o.numero,
          proveedor: x.o.proveedor || '',
          monto: num(x.o.total),
          referencia: x.o.id,
        });
      });

    out.sort((a, b) => a.dias - b.dias);
    return out;
  }

  /* ============================================================
     ESTADÍSTICAS AMPLIADAS
     ============================================================ */

  // Top N proveedores por gasto dentro de UN proyecto (solo gastos registrados, no órdenes).
  function topProveedoresPorGasto(proyectoId, gastos, n) {
    const gs = (gastos || []).filter((g) => g.proyectoId === proyectoId);
    const mapa = {};
    gs.forEach((g) => {
      const nombre = (g.proveedor || 'Sin proveedor').trim() || 'Sin proveedor';
      if (!mapa[nombre]) mapa[nombre] = { proveedor: nombre, total: 0, movimientos: 0 };
      mapa[nombre].total = r2(mapa[nombre].total + num(g.monto));
      mapa[nombre].movimientos += 1;
    });
    const lista = Object.keys(mapa).map((k) => mapa[k]);
    lista.sort((a, b) => b.total - a.total);
    return lista.slice(0, n == null ? 5 : num(n));
  }

  // Gastos agregados por tipo (material, mano_obra, equipo, etc.) para un proyecto.
  function gastosPorTipo(proyectoId, gastos) {
    const gs = (gastos || []).filter((g) => g.proyectoId === proyectoId);
    const mapa = {};
    TIPOS_GASTO.forEach((t) => (mapa[t.id] = { tipo: t.id, label: t.label, total: 0, movimientos: 0 }));
    gs.forEach((g) => {
      const t = g.tipo || 'otro';
      if (!mapa[t]) mapa[t] = { tipo: t, label: t, total: 0, movimientos: 0 };
      mapa[t].total = r2(mapa[t].total + num(g.monto));
      mapa[t].movimientos += 1;
    });
    const totalGeneral = r2(gs.reduce((s, g) => s + num(g.monto), 0));
    return Object.keys(mapa)
      .map((k) => Object.assign({}, mapa[k], { porcentaje: pct(mapa[k].total, totalGeneral) }))
      .sort((a, b) => b.total - a.total);
  }

  // Tendencia de gasto mensual: compara los últimos 3 meses reales para determinar
  // si el gasto está subiendo, bajando o estable.
  function tendenciaGasto(proyectoId, gastos) {
    const meses = reporteMensual(proyectoId, [], gastos); // categorias no se necesitan para el total
    const ultimos = meses.slice(-3);
    if (ultimos.length < 2) {
      return { tendencia: 'sin_datos', variacionPromedio: 0, meses: ultimos };
    }
    const variaciones = ultimos.slice(1).map((m) => m.variacionPct);
    const variacionPromedio = r2(variaciones.reduce((s, v) => s + v, 0) / variaciones.length);
    let tendencia = 'estable';
    if (variacionPromedio > 10) tendencia = 'creciente';
    else if (variacionPromedio < -10) tendencia = 'decreciente';
    return { tendencia, variacionPromedio, meses: ultimos };
  }

  /* ---------- datos de ejemplo (borrables desde Ajustes) ---------- */
  function proyectoDemo() {
    const p = nuevoProyecto({
      nombre: 'Remodelación Salón Principal',
      ubicacion: 'Managua',
      responsable: 'Walter',
      inicio: hoy(),
      notas: 'Proyecto de ejemplo. Puedes borrarlo desde Ajustes.',
    });
    const cats = categoriasIniciales(p.id);
    const pres = { 'Preliminares': 25000, 'Obra gris': 180000, 'Estructura y concreto': 120000, 'Techos': 95000, 'Eléctrico': 60000, 'Hidrosanitario': 45000, 'Acabados': 110000, 'Pintura': 38000, 'Carpintería': 42000, 'Herrería': 30000, 'Mano de obra general': 150000, 'Imprevistos': 50000 };
    cats.forEach((c) => (c.presupuesto = pres[c.nombre] || 0));
    const cat = (n) => (cats.filter((c) => c.nombre === n)[0] || {}).id;
    const g = (categoriaId, fecha, descripcion, proveedor, tipo, cantidad, unidad, precioUnitario) =>
      normalizarGasto({ proyectoId: p.id, categoriaId, fecha, descripcion, proveedor, tipo, cantidad, unidad, precioUnitario, pagado: true });
    const hoyD = new Date();
    const f = (dias) => new Date(hoyD.getTime() - dias * 86400000).toISOString().slice(0, 10);
    const fF = (dias) => new Date(hoyD.getTime() + dias * 86400000).toISOString().slice(0, 10);
    const gastos = [
      g(cat('Preliminares'), f(75), 'Limpieza y demolición', 'Cuadrilla local', 'mano_obra', 1, 'global', 22000),
      g(cat('Obra gris'), f(60), 'Cemento gris 42.5 kg', 'Ferretería Jenny', 'material', 180, 'bolsa', 385),
      g(cat('Obra gris'), f(52), 'Arena y piedrín', 'Materiales del Sur', 'material', 12, 'm3', 1450),
      g(cat('Estructura y concreto'), f(48), 'Varilla #3 y #4', 'Ferretería Jenny', 'material', 90, 'qq', 980),
      g(cat('Techos'), f(30), 'Lámina troquelada cal. 26', 'Techos MG', 'material', 64, 'lám', 1180),
      g(cat('Eléctrico'), f(22), 'Cable THHN #12 y canalización', 'Eléctricos RC', 'material', 1, 'lote', 31500),
      g(cat('Eléctrico'), f(20), 'Instalación de circuitos', 'Ing. Mendoza', 'mano_obra', 1, 'global', 24000),
      g(cat('Hidrosanitario'), f(18), 'Tubería PVC y accesorios', 'Ferretería Jenny', 'material', 1, 'lote', 19800),
      g(cat('Mano de obra general'), f(14), 'Planilla quincena', 'Cuadrilla local', 'mano_obra', 1, 'quincena', 46000),
      g(cat('Mano de obra general'), f(4), 'Planilla quincena', 'Cuadrilla local', 'mano_obra', 1, 'quincena', 46000),
      g(cat('Pintura'), f(6), 'Pintura acrílica blanca', 'Pinturas Sur', 'material', 22, 'cubeta', 1950),
    ];
    const lic = {
      id: uid('li'),
      proyectoId: p.id,
      categoriaId: cat('Acabados'),
      titulo: 'Piso porcelanato 60x60 — 180 m²',
      unidad: 'm²',
      cantidad: 180,
      notas: 'Incluye material puesto en obra. La instalación se cotiza aparte.',
      pesos: Object.assign({}, PESOS_DEFECTO),
      adjudicadaA: null,
      creado: new Date().toISOString(),
      ofertas: [
        { id: uid('of'), proveedor: 'Cerámicas del Norte', precioUnitario: 495, total: 0, dias: 12, calidad: 4, garantia: 12, notas: 'Marca española, buen historial.' },
        { id: uid('of'), proveedor: 'Distribuidora Azulejo', precioUnitario: 448, total: 0, dias: 21, calidad: 3, garantia: 6, notas: 'Más barato pero entrega lenta.' },
        { id: uid('of'), proveedor: 'Importadora Piso Real', precioUnitario: 528, total: 0, dias: 7, calidad: 5, garantia: 24, notas: 'Entrega inmediata y garantía extendida.' },
      ],
    };

    // Órdenes de compra de ejemplo para este proyecto.
    const ordenes = [
      normalizarOrden({
        proyectoId: p.id,
        categoriaId: cat('Obra gris'),
        numero: 'OC-000101',
        proveedor: 'Ferretería Jenny',
        fecha: f(10),
        fechaEntrega: fF(5),
        items: [
          { descripcion: 'Cemento gris 42.5 kg', cantidad: 100, unidad: 'bolsa', precioUnitario: 385 },
          { descripcion: 'Varilla #3', cantidad: 40, unidad: 'qq', precioUnitario: 980 },
        ],
        impuesto: r2((100 * 385 + 40 * 980) * 0.15),
        estado: 'aprobada',
        notas: 'Entrega parcial acordada con el proveedor.',
      }),
      normalizarOrden({
        proyectoId: p.id,
        categoriaId: cat('Acabados'),
        numero: 'OC-000102',
        proveedor: 'Importadora Piso Real',
        fecha: f(3),
        fechaEntrega: fF(15),
        items: [
          { descripcion: 'Porcelanato 60x60', cantidad: 180, unidad: 'm²', precioUnitario: 528 },
        ],
        impuesto: r2(180 * 528 * 0.15),
        estado: 'borrador',
        notas: 'Pendiente de aprobación final.',
      }),
    ];

    // Contrato de ejemplo.
    const contratos = [
      normalizarContrato({
        proyectoId: p.id,
        proveedor: 'Cuadrilla local',
        titulo: 'Mano de obra general — remodelación completa',
        montoContrato: 300000,
        anticipo: 60000,
        retencion: 15000,
        fechaInicio: f(75),
        fechaFin: fF(60),
        estado: 'vigente',
        avance: 45,
        notas: 'Pago quincenal según avance certificado.',
      }),
    ];

    return { proyecto: p, categorias: cats, gastos, licitaciones: [lic], ordenes, contratos };
  }

  // Segundo proyecto de ejemplo, más chico y con un sobrecosto visible.
  function proyectoDemo2() {
    const p = nuevoProyecto({
      nombre: 'Mantenimiento Anexo Norte',
      ubicacion: 'Ciudad Sandino',
      responsable: 'Comité de propiedad',
      inicio: new Date(Date.now() - 40 * 86400000).toISOString().slice(0, 10),
      estado: 'activo',
      notas: 'Proyecto de ejemplo. Puedes borrarlo desde Proyectos.',
    });
    const cats = categoriasIniciales(p.id).filter((c) =>
      ['Preliminares', 'Techos', 'Eléctrico', 'Pintura', 'Mano de obra general', 'Imprevistos'].indexOf(c.nombre) !== -1
    );
    const pres = { 'Preliminares': 8000, 'Techos': 62000, 'Eléctrico': 18000, 'Pintura': 24000, 'Mano de obra general': 40000, 'Imprevistos': 12000 };
    cats.forEach((c) => (c.presupuesto = pres[c.nombre] || 0));
    const cat = (n) => (cats.filter((c) => c.nombre === n)[0] || {}).id;
    const f = (dias) => new Date(Date.now() - dias * 86400000).toISOString().slice(0, 10);
    const g = (categoriaId, fecha, descripcion, proveedor, tipo, cantidad, unidad, precioUnitario, pagado) =>
      normalizarGasto({ proyectoId: p.id, categoriaId, fecha, descripcion, proveedor, tipo, cantidad, unidad, precioUnitario, pagado: pagado !== false });
    const gastos = [
      g(cat('Preliminares'), f(35), 'Andamios (alquiler)', 'Andamios León', 'equipo', 1, 'mes', 7500),
      g(cat('Techos'), f(28), 'Cambio de zinc dañado', 'Techos MG', 'material', 38, 'lám', 1180),
      g(cat('Techos'), f(26), 'Instalación de láminas', 'Cuadrilla Anexo', 'mano_obra', 1, 'global', 21000),
      g(cat('Pintura'), f(12), 'Sellador y pintura exterior', 'Pinturas Sur', 'material', 16, 'cubeta', 1950),
      g(cat('Pintura'), f(9), 'Aplicación de pintura', 'Cuadrilla Anexo', 'mano_obra', 1, 'global', 9800, false),
      g(cat('Eléctrico'), f(5), 'Reemplazo de luminarias', 'Eléctricos RC', 'material', 14, 'unidad', 890, false),
    ];
    return { proyecto: p, categorias: cats, gastos, licitaciones: [], ordenes: [], contratos: [], pagos: [] };
  }

  // Catálogo de proveedores de ejemplo (con los campos ampliados).
  function proveedoresDemo() {
    return [
      normalizarProveedor({ nombre: 'Ferretería Jenny', contacto: 'Jenny Ruiz', telefono: '8888-1111', categorias: ['material'], calificacion: 4, condicionesPago: '30 días crédito', tiempoEntregaPromedio: 3, notas: 'Proveedor principal de materiales.' }),
      normalizarProveedor({ nombre: 'Techos MG', contacto: 'Marco Guevara', telefono: '8888-2222', categorias: ['material', 'mano_obra'], calificacion: 5, condicionesPago: 'Contado', tiempoEntregaPromedio: 7, notas: 'Especialista en techos.' }),
      normalizarProveedor({ nombre: 'Cuadrilla local', contacto: 'Don Chepe', telefono: '8888-3333', categorias: ['mano_obra'], calificacion: 4, condicionesPago: 'Quincenal', tiempoEntregaPromedio: 0, notas: 'Cuadrilla de confianza, varios años de trabajo.' }),
      normalizarProveedor({ nombre: 'Importadora Piso Real', contacto: 'Sandra Ríos', telefono: '8888-4444', categorias: ['material'], calificacion: 5, condicionesPago: '50% anticipo', tiempoEntregaPromedio: 15, notas: 'Buena garantía, entrega puntual.' }),
      normalizarProveedor({ nombre: 'Eléctricos RC', contacto: 'Roberto Cruz', telefono: '8888-5555', categorias: ['material', 'mano_obra'], calificacion: 3, condicionesPago: 'Contado', tiempoEntregaPromedio: 5, notas: '' }),
    ];
  }

  function estadoDemo() {
    const e = estadoVacio();
    const a = proyectoDemo();
    const b = proyectoDemo2();
    e.proyectos = [a.proyecto, b.proyecto];
    e.categorias = a.categorias.concat(b.categorias);
    e.gastos = a.gastos.concat(b.gastos);
    e.licitaciones = a.licitaciones.concat(b.licitaciones);
    e.ordenes = (a.ordenes || []).concat(b.ordenes || []);
    e.contratos = (a.contratos || []).concat(b.contratos || []);
    e.proveedores = proveedoresDemo();
    e.pagos = (a.pagos || []).concat(b.pagos || []);
    e.proyectoActivo = a.proyecto.id;
    return e;
  }

  const ENGINE = {
    // utilidades
    num, r2, pct, uid, hoy, mesDe, nombreMes, sumarMeses,
    // catálogos
    TIPOS_GASTO, CATEGORIAS_BASE, FASES, ICONOS, PESOS_DEFECTO, ESTADOS, ESTADOS_PROYECTO,
    estadosOrden, estadosContrato,
    // esquema
    estadoVacio, estadoDemo, nuevoProyecto, categoriasIniciales, normalizarGasto, proyectoDemo,
    normalizarProveedor, normalizarOrden, normalizarContrato, normalizarPago,
    TIPOS_PAGO, METODOS_PAGO, historialPagos, resumenPagosContrato, resumenPagosProveedor, resumenPagosTrabajador,
    // motores
    clasificar, varianzaCategoria, varianzaProyecto,
    totalOferta, compararOfertas,
    reporteMensual, reportePorFase, alertas,
    diasHasta, gastosProximosAVencer,
    resumenCartera, clonarProyecto, ubicacionesUsadas, resumenPorUbicacion,
    // flujo de caja
    flujoMensual, proyeccionFlujo,
    // proveedores mejorados
    historialProveedor, rankingProveedores,
    // contratos
    varianzaContrato,
    // calendario de pagos
    calendarioPagos, proximosPagos,
    // estadísticas ampliadas
    topProveedoresPorGasto, gastosPorTipo, tendenciaGasto,
  };

  global.ENGINE = ENGINE;
  if (typeof module !== 'undefined' && module.exports) module.exports = ENGINE;
})(typeof window !== 'undefined' ? window : globalThis);
