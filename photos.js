/* ============================================================
   OBRA FIRME — FOTOS DE FACTURAS
   Guarda las fotos en IndexedDB (no en localStorage, que tiene
   un límite de ~5MB y se llenaría con un par de fotos).
   Cada foto queda ligada a un gasto por su gastoId.
   Expone window.FOTOS (navegador) y module.exports (Node, pruebas).
   ============================================================ */
(function (global) {
  'use strict';

  const NOMBRE_DB = 'obrafirme_fotos';
  const VERSION_DB = 1;
  const TIENDA = 'facturas';
  const MAX_LADO = 1600;
  const CALIDAD_JPEG = 0.72;
  const MAX_FOTOS_POR_GASTO = 4;

  const uid = () => 'fo_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  function dimensionesObjetivo(anchoOriginal, altoOriginal, maxLado) {
    const tope = maxLado || MAX_LADO;
    const a = Math.max(1, Math.round(anchoOriginal) || 1);
    const h = Math.max(1, Math.round(altoOriginal) || 1);
    if (a <= tope && h <= tope) return { ancho: a, alto: h };
    const factor = a >= h ? tope / a : tope / h;
    return { ancho: Math.max(1, Math.round(a * factor)), alto: Math.max(1, Math.round(h * factor)) };
  }

  function tamanoAprox(dataURL) {
    const s = String(dataURL || '');
    const i = s.indexOf(',');
    const b64 = i === -1 ? '' : s.slice(i + 1);
    return Math.round(b64.length * 0.75);
  }

  function crearRegistro(gastoId, dataURL, ancho, alto) {
    return {
      id: uid(),
      gastoId,
      dataURL,
      ancho: Math.round(ancho) || 0,
      alto: Math.round(alto) || 0,
      bytes: tamanoAprox(dataURL),
      creado: new Date().toISOString(),
    };
  }

  function idsHuerfanos(fotos, idsGastosValidos) {
    const validos = new Set(idsGastosValidos || []);
    return (fotos || []).filter((f) => !validos.has(f.gastoId)).map((f) => f.id);
  }

  function contarPorGasto(fotos) {
    const mapa = {};
    (fotos || []).forEach((f) => { mapa[f.gastoId] = (mapa[f.gastoId] || 0) + 1; });
    return mapa;
  }

  function puedeAgregarMas(actuales) {
    return (actuales || []).length < MAX_FOTOS_POR_GASTO;
  }

  function bytesTotales(fotos) {
    return (fotos || []).reduce((s, f) => s + (f.bytes || tamanoAprox(f.dataURL)), 0);
  }

  let _db = null;

  function abrir() {
    if (_db) return Promise.resolve(_db);
    if (typeof indexedDB === 'undefined') {
      return Promise.reject(new Error('Este navegador no permite guardar fotos localmente.'));
    }
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(NOMBRE_DB, VERSION_DB);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(TIENDA)) {
          const almacen = db.createObjectStore(TIENDA, { keyPath: 'id' });
          almacen.createIndex('porGasto', 'gastoId', { unique: false });
        }
      };
      req.onsuccess = () => { _db = req.result; resolve(_db); };
      req.onerror = () => reject(req.error || new Error('No se pudo abrir el almacén de fotos.'));
    });
  }

  function envolver(req) {
    return new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  function operacion(modo, fn) {
    return abrir().then((db) => new Promise((resolve, reject) => {
      const tx = db.transaction([TIENDA], modo);
      const almacen = tx.objectStore(TIENDA);
      let valor, fallo = null;
      Promise.resolve().then(() => fn(almacen)).then((r) => { valor = r; }).catch((e) => { fallo = e; });
      tx.oncomplete = () => (fallo ? reject(fallo) : resolve(valor));
      tx.onerror = () => reject(tx.error || fallo || new Error('Error en el almacén de fotos.'));
      tx.onabort = () => reject(tx.error || fallo || new Error('Se canceló la operación con las fotos.'));
    }));
  }

  function guardar(gastoId, dataURL, ancho, alto) {
    const registro = crearRegistro(gastoId, dataURL, ancho, alto);
    return operacion('readwrite', (almacen) => envolver(almacen.put(registro)).then(() => registro));
  }

  function listarPorGasto(gastoId) {
    return operacion('readonly', (almacen) => envolver(almacen.index('porGasto').getAll(gastoId)));
  }

  function eliminar(id) {
    return operacion('readwrite', (almacen) => envolver(almacen.delete(id)));
  }

  function eliminarPorGasto(gastoId) {
    return operacion('readwrite', async (almacen) => {
      const fotos = await envolver(almacen.index('porGasto').getAll(gastoId));
      for (const f of fotos) await envolver(almacen.delete(f.id));
      return fotos.length;
    });
  }

  function todas() {
    return operacion('readonly', (almacen) => envolver(almacen.getAll()));
  }

  function restaurar(lista) {
    return operacion('readwrite', async (almacen) => {
      for (const f of (lista || [])) await envolver(almacen.put(f));
      return (lista || []).length;
    });
  }

  function vaciar() {
    return operacion('readwrite', (almacen) => envolver(almacen.clear()));
  }

  function limpiarHuerfanas(idsGastosValidos) {
    return todas().then((fotos) => {
      const ids = idsHuerfanos(fotos, idsGastosValidos);
      return Promise.all(ids.map((id) => eliminar(id))).then(() => ids.length);
    });
  }

  function comprimirArchivo(file, maxLado) {
    return new Promise((resolve, reject) => {
      if (typeof FileReader === 'undefined' || typeof Image === 'undefined') {
        reject(new Error('Este navegador no puede procesar imágenes.'));
        return;
      }
      const lector = new FileReader();
      lector.onerror = () => reject(new Error('No se pudo leer la imagen.'));
      lector.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error('El archivo no parece ser una imagen válida.'));
        img.onload = () => {
          try {
            const dim = dimensionesObjetivo(img.naturalWidth || img.width, img.naturalHeight || img.height, maxLado);
            const lienzo = document.createElement('canvas');
            lienzo.width = dim.ancho;
            lienzo.height = dim.alto;
            const ctx = lienzo.getContext('2d');
            ctx.drawImage(img, 0, 0, dim.ancho, dim.alto);
            const dataURL = lienzo.toDataURL('image/jpeg', CALIDAD_JPEG);
            resolve({ dataURL, ancho: dim.ancho, alto: dim.alto });
          } catch (e) {
            reject(e);
          }
        };
        img.src = lector.result;
      };
      lector.readAsDataURL(file);
    });
  }

  const FOTOS = {
    MAX_FOTOS_POR_GASTO, MAX_LADO,
    dimensionesObjetivo, tamanoAprox, crearRegistro, idsHuerfanos, contarPorGasto, puedeAgregarMas, bytesTotales,
    abrir, guardar, listarPorGasto, eliminar, eliminarPorGasto, todas, restaurar, vaciar, limpiarHuerfanas,
    comprimirArchivo,
  };

  global.FOTOS = FOTOS;
  if (typeof module !== 'undefined' && module.exports) module.exports = FOTOS;
})(typeof window !== 'undefined' ? window : globalThis);
