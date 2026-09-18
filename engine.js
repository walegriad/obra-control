/* ============================================================
   OBRA FIRME — MOTOR DE DATOS Y CÁLCULO
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

  const hoy = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0'); };
  const mesDe = (fecha) => String(fecha || '').slice(0, 7); // YYYY-MM

  const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  const nombreMes = (ym) => {
    const [a, m] = String(ym).split('-');
    return (MESES[parseInt(m, 10) - 1] || '?') + ' ' + a;
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
      fotosNube:    [{ id, gastoId, url, ancho, alto, bytes, creado }]
                    // Índice de las fotos que ya están en el bucket de Supabase
                    // Storage. Las imágenes en sí NO viven aquí (viajarían en
                    // cada sincronización); esto solo dice "esta foto existe y
                    // se descarga de esta URL". Ver supaFotos* en index.html.
    }
  */
  // Estados para órdenes de compra
  const ESTADOS_ORDEN = [
    { id: 'borrador', label: 'Borrador' },
    { id: 'solicitada', label: 'Solicitada' },
    { id: 'aprobada', label: 'Aprobada' },
    { id: 'recibida', label: 'Recibida' },
    { id: 'cancelada', label: 'Cancelada' },
  ];

  // Estados para contratos
  const ESTADOS_CONTRATO = [
    { id: 'vigente', label: 'Vigente' },
    { id: 'completado', label: 'Completado' },
    { id: 'cancelado', label: 'Cancelado' },
  ];

  // Tipos de pago
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
  ];

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
      fotosNube: [],
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
     ÓRDENES DE COMPRA
     ============================================================ */
  function normalizarOrden(o) {
    const items = (o.items || []).map((it) => ({
      descripcion: it.descripcion || '',
      cantidad: num(it.cantidad),
      unidad: it.unidad || 'unidad',
      precioUnitario: r2(it.precioUnitario),
      marca: it.marca || '',
    }));
    const subtotal = r2(items.reduce((s, it) => s + r2(it.cantidad * it.precioUnitario), 0));
    const ivaRate = num(o.iva != null ? o.iva : 15);
    const aplicaIR = !!o.aplicaRetencionIR;
    const impuesto = r2(subtotal * ivaRate / 100);
    const retencionIR = aplicaIR ? r2(subtotal * 0.02) : 0;
    const total = r2(subtotal + impuesto - retencionIR);
    return {
      id: o.id || uid('oc'),
      proyectoId: o.proyectoId,
      numero: o.numero || '',
      proveedor: o.proveedor || '',
      estado: o.estado || 'borrador',
      items,
      subtotal, impuesto, retencionIR, total,
      iva: ivaRate,
      aplicaRetencionIR: aplicaIR,
      fechaCreacion: o.fechaCreacion || hoy(),
      fechaAprobacion: o.fechaAprobacion || '',
      fechaEntrega: o.fechaEntrega || '',
      fechaRecepcion: o.fechaRecepcion || '',
      solicitadoPor: o.solicitadoPor || '',
      aprobadoPor: o.aprobadoPor || '',
      notas: o.notas || '',
      creado: o.creado || new Date().toISOString(),
    };
  }

  /* ============================================================
     CONTRATOS
     ============================================================ */
  function normalizarContrato(c) {
    const montoContrato = r2(c.montoContrato);
    const anticipo = r2(c.anticipo);
    const retencion = r2(c.retencion);
    return {
      id: c.id || uid('co'),
      proyectoId: c.proyectoId,
      proveedor: c.proveedor || '',
      titulo: c.titulo || 'Contrato sin título',
      montoContrato,
      anticipo,
      retencion,
      fechaInicio: c.fechaInicio || hoy(),
      fechaFin: c.fechaFin || '',
      estado: c.estado || 'vigente',
      avance: num(c.avance),
      notas: c.notas || '',
      creado: c.creado || new Date().toISOString(),
    };
  }

  /* ============================================================
     PAGOS (ABONOS, ADELANTOS, ANTICIPOS)
     ============================================================ */
  function normalizarPago(p) {
    return {
      id: p.id || uid('pg'),
      proyectoId: p.proyectoId,
      contratoId: p.contratoId || '',
      tipo: p.tipo || 'abono',
      metodo: p.metodo || 'efectivo',
      referencia: p.referencia || '',
      monto: r2(p.monto),
      fecha: p.fecha || hoy(),
      proveedorId: p.proveedorId || '',
      trabajador: p.trabajador || '',
      descripcion: p.descripcion || '',
      notas: p.notas || '',
      creado: p.creado || new Date().toISOString(),
    };
  }

  function resumenPagosContrato(pagos, contratoId) {
    const propios = pagos.filter((p) => p.contratoId === contratoId);
    return {
      total: r2(propios.reduce((s, p) => s + num(p.monto), 0)),
      cantidad: propios.length,
      pagos: propios.sort((a, b) => a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0),
    };
  }

  /* ============================================================
     FLUJO DE CAJA — proyección de entradas y salidas
     ============================================================ */
  function flujoDeCaja(proyectoId, gastos, ordenes, contratos, pagos, mesesAtras, mesesAdelante) {
    mesesAtras = mesesAtras || 3;
    mesesAdelante = mesesAdelante || 3;
    const ahora = new Date();
    const resultado = [];

    for (let i = -mesesAtras; i <= mesesAdelante; i++) {
      const d = new Date(ahora.getFullYear(), ahora.getMonth() + i, 1);
      const ym = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
      const etiqueta = nombreMes(ym);

      // Salidas: gastos pagados en este mes
      const salGastos = r2(gastos.filter((g) => g.proyectoId === proyectoId && g.pagado && mesDe(g.fecha) === ym)
        .reduce((s, g) => s + num(g.monto), 0));

      // Salidas: pagos realizados en este mes
      const salPagos = r2((pagos || []).filter((p) => p.proyectoId === proyectoId && mesDe(p.fecha) === ym)
        .reduce((s, p) => s + num(p.monto), 0));

      // Salidas futuras: gastos no pagados con vencimiento este mes
      const salPendientes = r2(gastos.filter((g) => g.proyectoId === proyectoId && !g.pagado && mesDe(g.fechaVencimiento) === ym)
        .reduce((s, g) => s + num(g.monto), 0));

      // Salidas futuras: órdenes aprobadas con entrega este mes
      const salOrdenes = r2((ordenes || []).filter((o) => o.proyectoId === proyectoId && o.estado === 'aprobada' && mesDe(o.fechaEntrega) === ym)
        .reduce((s, o) => s + num(o.total), 0));

      const totalSalidas = r2(salGastos + salPagos + salPendientes + salOrdenes);
      const esFuturo = i > 0;

      resultado.push({
        mes: ym, etiqueta, esFuturo,
        salidas: totalSalidas,
        gastosReales: salGastos,
        pagosReales: salPagos,
        pendientes: salPendientes,
        ordenesAprobadas: salOrdenes,
      });
    }
    return resultado;
  }

  /* ============================================================
     CALENDARIO DE PAGOS — eventos de un mes
     ============================================================ */
  function calendarioPagos(proyectoId, gastos, ordenes, contratos, pagos, mes) {
    const evs = [];
    // Gastos no pagados con vencimiento
    (gastos || []).filter((g) => g.proyectoId === proyectoId && !g.pagado && g.fechaVencimiento && mesDe(g.fechaVencimiento) === mes)
      .forEach((g) => evs.push({ tipo: 'gasto', fecha: g.fechaVencimiento, desc: g.descripcion || 'Gasto', monto: g.monto, proveedor: g.proveedor }));
    // Órdenes aprobadas con fecha de entrega
    (ordenes || []).filter((o) => o.proyectoId === proyectoId && o.estado === 'aprobada' && o.fechaEntrega && mesDe(o.fechaEntrega) === mes)
      .forEach((o) => evs.push({ tipo: 'orden', fecha: o.fechaEntrega, desc: 'OC ' + o.numero, monto: o.total, proveedor: o.proveedor }));
    // Pagos realizados
    (pagos || []).filter((p) => p.proyectoId === proyectoId && mesDe(p.fecha) === mes)
      .forEach((p) => evs.push({ tipo: 'pago', fecha: p.fecha, desc: p.descripcion, monto: p.monto, proveedor: '' }));
    return evs;
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

  function totalOferta(oferta, cantidad) {
    const cant = num(cantidad);
    if (num(oferta.total) > 0) return r2(oferta.total);
    return r2(num(oferta.precioUnitario) * (cant > 0 ? cant : 1));
  }

  function compararOfertas(licitacion) {
    const pesos = Object.assign({}, PESOS_DEFECTO, licitacion.pesos || {});
    const cantidad = num(licitacion.cantidad);
    const base = (licitacion.ofertas || []).map((o) => {
      const total = totalOferta(o, cantidad);
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

    const ordenes = incluirGastos
      ? (estado.ordenes || []).filter((o) => o.proyectoId === proyectoId)
          .map((o) => normalizarOrden(Object.assign({}, o, { id: uid('oc'), proyectoId: p.id, estado: 'borrador', creado: new Date().toISOString() })))
      : [];

    const contratos = incluirGastos
      ? (estado.contratos || []).filter((c) => c.proyectoId === proyectoId)
          .map((c) => normalizarContrato(Object.assign({}, c, { id: uid('co'), proyectoId: p.id, creado: new Date().toISOString() })))
      : [];

    return { proyecto: p, categorias, gastos, licitaciones, ordenes, contratos, pagos: [] };
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
    // Órdenes de ejemplo
    const ordenes = [
      normalizarOrden({ proyectoId: p.id, numero: 'OC-001', proveedor: 'Ferretería Jenny', estado: 'aprobada', iva: 15, fechaEntrega: f(-5),
        items: [{ descripcion: 'Cemento gris 42.5 kg', cantidad: 50, unidad: 'bolsa', precioUnitario: 385, marca: 'Canal' },
                { descripcion: 'Arena lavada', cantidad: 8, unidad: 'm3', precioUnitario: 1450, marca: '' }],
        solicitadoPor: 'Walter', aprobadoPor: 'Walter', fechaAprobacion: f(10) }),
      normalizarOrden({ proyectoId: p.id, numero: 'OC-002', proveedor: 'Techos MG', estado: 'solicitada', iva: 15,
        items: [{ descripcion: 'Lámina troquelada cal. 26', cantidad: 30, unidad: 'lám', precioUnitario: 1180, marca: 'Metalco' }],
        solicitadoPor: 'Walter' }),
    ];
    // Contrato de ejemplo
    const contratos = [
      normalizarContrato({ proyectoId: p.id, proveedor: 'Cuadrilla local', titulo: 'Mano de obra general — remodelación completa',
        montoContrato: 300000, anticipo: 60000, retencion: 15000, fechaInicio: f(70), fechaFin: f(-30),
        estado: 'vigente', avance: 45, notas: 'Pago quincenal según avance certificado.' }),
    ];
    // Pagos de ejemplo
    const pagos = [
      normalizarPago({ proyectoId: p.id, contratoId: contratos[0].id, tipo: 'anticipo', metodo: 'transferencia',
        monto: 60000, fecha: f(65), descripcion: 'Anticipo contrato mano de obra', referencia: 'TRF-1001' }),
      normalizarPago({ proyectoId: p.id, contratoId: contratos[0].id, tipo: 'abono', metodo: 'cheque',
        monto: 46000, fecha: f(14), descripcion: 'Abono quincena 1', referencia: 'CHQ-2050' }),
    ];
    return { proyecto: p, categorias: cats, gastos, licitaciones: [lic], ordenes, contratos, pagos };
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
    e.pagos = (a.pagos || []).concat(b.pagos || []);
    e.proyectoActivo = a.proyecto.id;
    return e;
  }

  const ENGINE = {
    // utilidades
    num, r2, pct, uid, hoy, mesDe, nombreMes,
    // catálogos
    TIPOS_GASTO, CATEGORIAS_BASE, FASES, ICONOS, PESOS_DEFECTO, ESTADOS, ESTADOS_PROYECTO,
    ESTADOS_ORDEN, ESTADOS_CONTRATO, TIPOS_PAGO, METODOS_PAGO,
    // esquema
    estadoVacio, estadoDemo, nuevoProyecto, categoriasIniciales, normalizarGasto, proyectoDemo,
    normalizarOrden, normalizarContrato, normalizarPago,
    // motores
    clasificar, varianzaCategoria, varianzaProyecto,
    totalOferta, compararOfertas,
    reporteMensual, reportePorFase, alertas,
    diasHasta, gastosProximosAVencer,
    resumenCartera, clonarProyecto, ubicacionesUsadas, resumenPorUbicacion,
    // nuevos módulos
    resumenPagosContrato, flujoDeCaja, calendarioPagos,
  };

  global.ENGINE = ENGINE;
  if (typeof module !== 'undefined' && module.exports) module.exports = ENGINE;
})(typeof window !== 'undefined' ? window : globalThis);
