
function fmtFechaHora(val) {
  if (!val) return '';
  const d = new Date(val);
  if (isNaN(d)) return String(val);
  return d.toLocaleDateString('es-PY',{day:'2-digit',month:'2-digit',year:'numeric'})
       + ' ' + d.toLocaleTimeString('es-PY',{hour:'2-digit',minute:'2-digit'});
}// ============================================
// TECH MARKET - App v4.0
// Nuevas: Thermer JSON fix, cuotas vencidas por cliente,
// todo mayusculas, anulacion venta/pago, reimpresion pagos
// ============================================

const CIUDADES_PY = [
  'ASUNCIÓN','FERNANDO DE LA MORA','LAMBARÉ','LUQUE','SAN LORENZO','CAPIATÁ','LIMPIO',
  'ÑEMBY','VILLA ELISA','MARIANO ROQUE ALONSO','ITAUGUÁ','AREGUÁ','YPACARAÍ','CAACUPÉ',
  'PARAGUARÍ','VILLETA','SAN ANTONIO','YPANÉ','CIUDAD DEL ESTE','PRESIDENTE FRANCO',
  'HERNANDARIAS','MINGA GUAZÚ','ENCARNACIÓN','CORONEL OVIEDO','CONCEPCIÓN',
  'PEDRO JUAN CABALLERO','OTRO'
];

const MOTIVOS_ANULACION = [
  'CLIENTE DESISTIÓ DE LA COMPRA',
  'ERROR EN EL VALOR DE LA OPERACIÓN',
  'ERROR EN SELECCIÓN DE PRODUCTO',
  'PAGO REGISTRADO POR ERROR',
  'DUPLICADO',
  'OTROS'
];

let APP = {
  user: null, clientes: [], clienteActual: null,
  ventaActual: [], ventaClientePreseleccionado: null, modoEdicion: false
};

// ============================================
// SESSION
// ============================================
function guardarSesion(u) { sessionStorage.setItem('tm_user', JSON.stringify(u)); }
function recuperarSesion() { try { const r = sessionStorage.getItem('tm_user'); return r ? JSON.parse(r) : null; } catch(e) { return null; } }
function cerrarSesion() { sessionStorage.removeItem('tm_user'); location.reload(); }

// ============================================
// TOAST + LOADER + ANIMACIÓN
// ============================================
function toast(msg, tipo='info', dur=3000) {
  const c = {success:{bg:'#10b981',icon:'✅'},error:{bg:'#ef4444',icon:'❌'},warning:{bg:'#f59e0b',icon:'⚠️'},info:{bg:'#3b82f6',icon:'ℹ️'}}[tipo]||{bg:'#3b82f6',icon:'ℹ️'};
  const t = document.createElement('div');
  t.style.cssText = `position:fixed;bottom:90px;left:50%;transform:translateX(-50%) translateY(20px);background:${c.bg};color:white;padding:14px 22px;border-radius:14px;font-size:15px;font-weight:600;z-index:9999;max-width:340px;text-align:center;box-shadow:0 8px 24px rgba(0,0,0,0.25);opacity:0;transition:all 0.35s cubic-bezier(0.34,1.56,0.64,1);display:flex;align-items:center;gap:10px;`;
  t.innerHTML = `<span style="font-size:20px">${c.icon}</span><span>${msg}</span>`;
  document.body.appendChild(t);
  requestAnimationFrame(()=>{ t.style.opacity='1'; t.style.transform='translateX(-50%) translateY(0)'; });
  setTimeout(()=>{ t.style.opacity='0'; t.style.transform='translateX(-50%) translateY(20px)'; setTimeout(()=>t.remove(),400); }, dur);
}
function showLoader(msg='PROCESANDO...') {
  const e = document.getElementById('loaderOverlay'); if(e) e.remove();
  const el = document.createElement('div');
  el.id = 'loaderOverlay';
  el.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:9998;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:20px;';
  el.innerHTML = `<div style="width:60px;height:60px;border:5px solid rgba(255,255,255,0.2);border-top-color:#10b981;border-radius:50%;animation:spin 0.8s linear infinite;"></div><div style="color:white;font-size:17px;font-weight:700;">${msg}</div><style>@keyframes spin{to{transform:rotate(360deg)}}</style>`;
  document.body.appendChild(el);
}
function hideLoader() { const e = document.getElementById('loaderOverlay'); if(e) e.remove(); }
function mostrarConfirmacion(msg) {
  hideLoader();
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:10000;display:flex;align-items:center;justify-content:center;';
  overlay.innerHTML = `<div style="background:white;border-radius:24px;padding:40px;text-align:center;max-width:300px;">
    <div style="width:80px;height:80px;margin:0 auto 20px;">
      <svg viewBox="0 0 80 80" style="width:80px;height:80px;">
        <circle cx="40" cy="40" r="36" fill="none" stroke="#e2e8f0" stroke-width="6"/>
        <circle cx="40" cy="40" r="36" fill="none" stroke="#10b981" stroke-width="6" stroke-dasharray="226" stroke-dashoffset="226" style="transition:stroke-dashoffset 0.6s ease;transform:rotate(-90deg);transform-origin:center;" id="circleAnim"/>
        <path d="M24 40 L35 51 L56 30" fill="none" stroke="#10b981" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="40" stroke-dashoffset="40" style="transition:stroke-dashoffset 0.4s ease 0.4s;" id="checkAnim"/>
      </svg>
    </div>
    <div style="font-size:18px;font-weight:700;color:#1e293b;">${msg}</div>
  </div>`;
  document.body.appendChild(overlay);
  requestAnimationFrame(()=>{ document.getElementById('circleAnim').style.strokeDashoffset='0'; document.getElementById('checkAnim').style.strokeDashoffset='0'; });
  setTimeout(()=>{ overlay.style.opacity='0'; overlay.style.transition='opacity 0.3s'; setTimeout(()=>overlay.remove(),300); },1800);
}

// ============================================
// HELPERS
// ============================================
function hideAll() {
  ['loginPage','dashboardPage','clientesPage','formClientePage','detalleClientePage','ventasPage','listadoVentasPage','cobranzasPage','verificadorPage'].forEach(id=>{
    const el=document.getElementById(id); if(el) el.classList.add('hidden');
  });
}
function fmtGs(n) { return 'GS. ' + Math.ceil(Number(n||0)).toLocaleString('es-PY'); }

// Helper para formatear input de miles sin decimales
function formatearMiles(input) {
  let valor = input.value.replace(/\D/g, '');
  if (valor) {
    input.value = parseInt(valor).toLocaleString('es-PY');
  }
}

function obtenerValorNumerico(input) {
  return parseInt(input.value.replace(/\D/g, '') || '0');
}

function fmtFecha(d) {
  if (!d) return '';
  const f = d instanceof Date ? d : new Date(d);
  if (isNaN(f)) return '';
  return f.toLocaleDateString('es-PY');
}
function fmtDateInput(d) {
  const f = d ? (d instanceof Date ? d : new Date(d)) : new Date();
  if (isNaN(f)) return new Date().toISOString().substring(0,10);
  return f.toISOString().substring(0,10);
}
function mayus(s) { return s ? String(s).toUpperCase() : ''; }
function formatTelWA(tel) {
  const d = String(tel||'').replace(/[^0-9]/g,'');
  if (!d) return '';
  if (d.startsWith('595')) return d;
  if (d.startsWith('0')) return '595' + d.substring(1);
  return '595' + d;
}

// ============================================
// THERMER BLUETOOTH PRINT - JSON objeto enumerado
// Formato: {"0":{...},"1":{...}} via Apps Script endpoint
// ============================================
async function imprimirTicketBluetooth(datos) {
  const sep = '--------------------------------';
  const items = [];
  const add = (content, bold=0, align=0, format=0) => items.push({type:0,content,bold,align,format});
  const addCenter = (content, bold=0, format=0) => add(content, bold, 1, format);
  const addBarcode = (value) => items.push({type:2, value:String(value).replace(/[^A-Z0-9]/g,''), width:250, height:70, align:1});
  const sp = () => add(' ');
  
  // Función helper para fecha con hora y segundos
  const fmtFechaHora = (fecha) => {
    const f = fecha instanceof Date ? fecha : new Date(fecha);
    const d = f.toLocaleDateString('es-PY');
    const h = f.toTimeString().substring(0,8);
    return d + ' ' + h;
  };

  addCenter('TM', 1, 3);
  sp();

  if (datos.tipo === 'pago') {
    addCenter('RECIBO DE PAGO', 1, 1);
    addCenter(sep);
    sp();
    add('FECHA: ' + fmtFechaHora(datos.fechaPago || new Date()));
    if (datos.clienteDoc) add('CLIENTE: ' + mayus(datos.clienteDoc));
    add(mayus(datos.nombreCliente));
    add('PEDIDO: ' + mayus(datos.numeroPedido));
    if (datos.productoDesc) add('PRODUCTO: ' + mayus(datos.productoDesc));
    add(sep);
    const numStr = String(datos.numeroCuota).padStart(2, '0');
    const totalStr = String(datos.totalCuotas).padStart(2, '0');
    add('CUOTA ' + numStr + '/' + totalStr + ' --- ' + fmtGs(datos.montoPago));
    add(sep);
    add('SALDO RESTANTE: ' + fmtGs(datos.saldoRestante));
    if (datos.proximaFecha) add('PROX. VENCIMIENTO: ' + fmtFecha(datos.proximaFecha));
    add(sep);
    sp();
    addBarcode(datos.codigoVerif);
    addCenter(mayus(datos.codigoVerif));
    addCenter('COBRADOR: ' + mayus(datos.cobrador));
    sp();
    addCenter('GRACIAS POR SU PAGO!');
    
  } else if (datos.tipo === 'venta') {
    addCenter('PRESUPUESTO', 1, 1);
    addCenter(sep);
    sp();
    add('FECHA: ' + fmtFechaHora(datos.fechaVenta || new Date()));
    if (datos.clienteDoc) add('CLIENTE: ' + mayus(datos.clienteDoc));
    add(mayus(datos.nombreCliente));
    add('PEDIDO: ' + mayus(datos.numeroPedido));
    add(sep);
    add('PRODUCTOS:');
    (datos.productos||[]).forEach(p => {
      add(mayus(p.descripcion));
      if (datos.garantiaMeses && datos.garantiaMeses > 0) {
        add('GARANTIA: ' + datos.garantiaMeses + ' MESES');
      }
      add(p.cantidad + 'X ' + fmtGs(p.precio));
    });
    add(sep);
    add('TOTAL: ' + fmtGs(datos.totalVenta));
    if (datos.cantidadCuotas > 0) {
      add('PLAN: ' + datos.cantidadCuotas + ' CUOTAS DE ' + fmtGs(datos.valorCuota));
    }
    add('VENDEDOR: ' + mayus(datos.vendedor));
    add(sep);
    sp();
    addCenter('GRACIAS POR SU COMPRA!');
    
  } else if (datos.tipo === 'estadoCuenta') {
    addCenter('EXTRACTO DE CUENTA', 1, 1);
    addCenter(sep);
    sp();
    add('FECHA: ' + fmtFechaHora(new Date()));
    if (datos.clienteDoc) add('CLIENTE: ' + mayus(datos.clienteDoc));
    add(mayus(datos.nombreCliente));
    add('PEDIDO: ' + mayus(datos.numeroPedido));
    if (datos.productoDesc) add('PRODUCTO: ' + mayus(datos.productoDesc));
    add('TOTAL: ' + fmtGs(datos.totalVenta));
    add(sep);
    add('CUOTAS PAGADAS:');
    sp();
    if (datos.pagos && datos.pagos.length > 0) {
      datos.pagos.forEach(trx => {
        // Nuevo formato agrupado: cada trx tiene Cuotas[] y Monto_Total
        const cuotas   = (trx.Cuotas && trx.Cuotas.length > 0) ? trx.Cuotas : [];
        const nCuotas  = cuotas.length;
        const totalStr = String(trx.Total_Cuotas || '?').padStart(2,'0');
        let cuotasDesc;
        if (nCuotas === 0)      cuotasDesc = 'PAGO';
        else if (nCuotas === 1) cuotasDesc = 'CUOTA ' + String(cuotas[0].Numero_Cuota).padStart(2,'0') + '/' + totalStr;
        else                    cuotasDesc = 'CUOTAS ' + cuotas.map(c => String(c.Numero_Cuota).padStart(2,'0')).join(',') + '/' + totalStr;
        const montoTrx     = trx.Monto_Total || 0;
        const primerCodigo = cuotas.length > 0 ? cuotas[0].Codigo_Verificacion : (trx.Ticket_ID_Grupo || '');
        add(fmtFechaHora(trx.Fecha_Pago));
        add(cuotasDesc + ' --- ' + fmtGs(montoTrx));
        // Imprimir codigo de barras por cada cuota individual
        cuotas.forEach(c => {
          addBarcode(c.Codigo_Verificacion);
          addCenter(mayus(c.Codigo_Verificacion), 0, 0);
        });
        if (cuotas.length === 0 && primerCodigo) {
          addBarcode(primerCodigo);
          addCenter(mayus(primerCodigo), 0, 0);
        }
        sp();
      });
    } else {
      add('SIN PAGOS REGISTRADOS');
      sp();
    }
    add(sep);
    add('MONTO RECIBIDO: ' + fmtGs(datos.pagos ? datos.pagos.reduce((sum, t) => sum + (t.Monto_Total || t.Monto_Pagado || 0), 0) : 0));
    add('SALDO RESTANTE: ' + fmtGs(datos.saldoRestante));
    if (datos.proximaFecha) add('PROX. VENCIMIENTO: ' + fmtFecha(datos.proximaFecha));
    if (datos.fechaPagare) add('VENCIMIENTO PAGARE: ' + fmtFecha(datos.fechaPagare));
    add(sep);
    sp();
    add('IMPRESO POR: ' + mayus(datos.impresoPor || 'SISTEMA'));
    add(fmtFechaHora(new Date()));
  }

  if (datos.tipo !== 'estadoCuenta') {
    addCenter('ESTE TICKET NO NECESITA');
    addCenter('SELLO NI FIRMA.');
  }
  add(sep);
  sp(); sp();

  const ticketJson = JSON.stringify(items);
  const ticketId = 'TKT-' + Date.now().toString(36).toUpperCase();
  try {
    await guardarTicketAPI(ticketId, ticketJson);
    const ticketURL = API_URL + '?action=getTicket&ticketId=' + encodeURIComponent(ticketId);
    const printURL = 'my.bluetoothprint.scheme://' + ticketURL;
    const a = document.createElement('a');
    a.href = printURL;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => a.remove(), 500);
    toast('ENVIANDO A IMPRESORA...', 'info', 2000);
  } catch(e) {
    toast('ERROR AL ENVIAR A IMPRESORA', 'error');
    console.error('Bluetooth print error:', e);
  }
}


// ============================================
// DASHBOARD
// ============================================
async function showDashboard() {
  hideAll();
  document.getElementById('dashboardPage').classList.remove('hidden');
  document.getElementById('userName').textContent = APP.user.nombre;
  document.getElementById('userRole').textContent = APP.user.rol;
  const stats = await getEstadisticasAPI();
  if (stats) {
    document.getElementById('statVentasHoy').textContent = stats.ventasHoy;
    document.getElementById('statCobrosHoy').textContent = stats.cobrosHoy;
    document.getElementById('statCuotasVencidas').textContent = stats.cuotasVencidas;
    document.getElementById('statVentasMes').textContent = fmtGs(stats.totalVentasMes||0);
    document.getElementById('statCreditosActivos').textContent = (stats.creditosActivos||0) + ' · ' + fmtGs(stats.totalCreditosActivos||0);
  }
}

// ============================================
// CLIENTES
// ============================================
async function showClientes() {
  hideAll();
  document.getElementById('clientesPage').classList.remove('hidden');
  document.getElementById('listaClientes').innerHTML = '<div class="loading">CARGANDO...</div>';
  APP.clientes = await getClientesAPI();
  renderClientes(APP.clientes);
}
function renderClientes(clientes) {
  if (!clientes.length) { document.getElementById('listaClientes').innerHTML='<div class="empty">NO HAY CLIENTES</div>'; return; }
  let html = '';
  clientes.forEach(c => {
    const alias = c.Alias ? `<div class="card-alias">"${c.Alias}"</div>` : '';
    html += `<div class="card" onclick="verDetalleCliente('${c.ID_Cliente}')">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <div>
          <div class="card-title">${c.Nombres} ${c.Apellidos}</div>
          ${alias}
          <div class="card-info">CI/RUC: ${c.CI_RUC}</div>
          <div class="card-info">📱 ${c.Telefono||'SIN TELÉFONO'}</div>
        </div>
        <div style="font-size:22px;opacity:0.3;">›</div>
      </div>
    </div>`;
  });
  document.getElementById('listaClientes').innerHTML = html;
}
document.getElementById('searchClientes').addEventListener('input', function(){
  const q = this.value.toUpperCase();
  renderClientes(APP.clientes.filter(c =>
    (c.Nombres+' '+c.Apellidos).includes(q) || String(c.CI_RUC).includes(q) ||
    String(c.Telefono||'').includes(q) || String(c.Alias||'').includes(q)
  ));
});

async function verDetalleCliente(id) {
  APP.clienteActual = APP.clientes.find(c => c.ID_Cliente === id);
  if (!APP.clienteActual) return;
  const c = APP.clienteActual;
  hideAll();
  document.getElementById('detalleClientePage').classList.remove('hidden');
  document.getElementById('detalleNombre').textContent = c.Nombres + ' ' + c.Apellidos;
  document.getElementById('detalleCiRuc').textContent = 'CI/RUC: ' + c.CI_RUC + (c.Alias ? '  •  "'+c.Alias+'"' : '');
  const telEl = document.getElementById('detalleTelefono');
  if (c.Telefono) telEl.innerHTML = `<a href="tel:${c.Telefono}" style="color:var(--accent);text-decoration:none;">📱 ${c.Telefono}</a>`;
  else telEl.textContent = 'SIN TELÉFONO';
  const waEl = document.getElementById('detalleWhatsapp');
  const waNum = formatTelWA(c.Tel_WhatsApp||c.Telefono);
  if (waNum) { waEl.href = 'https://wa.me/'+waNum; waEl.style.display='flex'; } else waEl.style.display='none';
  const dirEl = document.getElementById('detalleDireccion');
  if (c.GPS_Lat && c.GPS_Lng && String(c.GPS_Lat).length > 3) {
    dirEl.innerHTML = `<a href="https://www.google.com/maps?q=${c.GPS_Lat},${c.GPS_Lng}" target="_blank" style="color:var(--accent);text-decoration:none;">📍 ${c.Direccion||'VER EN MAPA'}</a>`;
  } else if (c.Direccion) {
    const q = encodeURIComponent((c.Direccion||'')+' '+(c.Ciudad||'')+' Paraguay');
    dirEl.innerHTML = `<a href="https://www.google.com/maps/search/${q}" target="_blank" style="color:var(--accent);text-decoration:none;">📍 ${c.Direccion}</a>`;
  } else dirEl.textContent = 'SIN DIRECCIÓN';
  document.getElementById('detalleCiudad').textContent = [c.Ciudad, c.Barrio].filter(Boolean).join(' - ') || 'NO REGISTRADA';
  document.getElementById('ventasCliente').innerHTML = '<div class="loading">CARGANDO COMPRAS...</div>';
  const ventas = await getVentasClienteAPI(id);
  renderVentasCliente(ventas);
}

function renderVentasCliente(ventas) {
  if (!ventas.length) { document.getElementById('ventasCliente').innerHTML='<div class="empty">SIN COMPRAS</div>'; return; }
  let html = '';
  ventas.forEach(v => {
    const tieneEntrega = parseFloat(v.Entrega_Inicial) > 0;
    const saldoColor = v.Saldo_Actual > 0 ? 'var(--danger)' : 'var(--success)';
    const badgeText = v.Saldo_Actual > 0 ? 'SALDO: '+fmtGs(v.Saldo_Actual) : '✅ PAGADO';
    const badgeClass = v.Saldo_Actual > 0 ? 'badge-warning' : 'badge-ok';
    html += `<div class="card" onclick="verDetalleVenta('${v.ID_Venta}')">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;">
        <div style="flex:1;">
          <div class="card-title">${v.Numero_Pedido}</div>
          <div class="card-info" style="font-weight:500;color:var(--text);">📦 ${v.Productos||'SIN PRODUCTOS'}</div>
          <div class="card-info">📅 ${fmtFecha(v.Fecha_Venta)}</div>
          <div class="card-info">TOTAL: ${fmtGs(v.Total_Venta)}${tieneEntrega?' · ENTREGA: '+fmtGs(v.Entrega_Inicial):''}</div>
          <div class="card-info" style="color:${saldoColor};font-weight:700;">SALDO ACTUAL: ${fmtGs(v.Saldo_Actual)}</div>
        </div>
        <span class="badge ${badgeClass}" style="margin-left:8px;white-space:nowrap;">${badgeText}</span>
      </div>
    </div>`;
  });
  document.getElementById('ventasCliente').innerHTML = html;
}

async function verDetalleVenta(idVenta) {
  const ventas = await getVentasClienteAPI(APP.clienteActual.ID_Cliente);
  const venta = ventas.find(v => v.ID_Venta === idVenta);
  if (!venta) return;
  const detalles = await getDetalleVentaAPI(idVenta);
  const cuotas = await getCuotasVentaAPI(idVenta);
  const pagos = await getPagosVentaAPI(idVenta);

  const productosHtml = detalles.map(d => `
    <div style="padding:10px 0;border-bottom:1px solid var(--border);">
      <div style="font-weight:600;">${d.Descripcion}</div>
      <div style="color:var(--muted);font-size:13px;">${d.Cantidad} X ${fmtGs(d.Precio_Unitario)} = ${fmtGs(d.Subtotal)}</div>
    </div>`).join('');

  const cuotasHtml = cuotas.map(cu => {
    const bc = cu.Estado==='PAGADA'?'badge-ok':cu.Estado==='PARCIAL'?'badge-warning':'badge-danger';
    const label = cu.Estado==='PAGADA'?'PAGADA':cu.Estado==='PARCIAL'?'PAGO PARCIAL':'PENDIENTE';
    return `<div style="padding:8px 0;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;">
      <div>
        <div style="font-size:13px;font-weight:600;">CUOTA ${cu.Numero_Cuota}/${cu.Total_Cuotas}</div>
        <div style="font-size:12px;color:var(--muted);">VENCE: ${fmtFecha(cu.Fecha_Vencimiento)}</div>
        ${parseFloat(cu.Monto_Pagado)>0?'<div style="font-size:12px;color:var(--success);">PAGADO: '+fmtGs(cu.Monto_Pagado)+'</div>':''}
      </div>
      <div style="text-align:right;">
        <div style="font-weight:700;">${fmtGs(cu.Saldo_Cuota>0?cu.Saldo_Cuota:cu.Monto_Cuota)}</div>
        <span class="badge ${bc}">${label}</span>
      </div>
    </div>`;
  }).join('');

  // Historial: UNA entrada por transaccion (el backend ya agrupa por Ticket_ID_Grupo)
  const pagosHtml = pagos.length ? pagos.map(trx => {
    const cuotas   = (trx.Cuotas && trx.Cuotas.length > 0) ? trx.Cuotas : [];
    const nCuotas  = cuotas.length;
    const totalStr = String(trx.Total_Cuotas || '?').padStart(2,'0');
    let cuotasDesc;
    if (nCuotas === 0)      cuotasDesc = 'PAGO';
    else if (nCuotas === 1) cuotasDesc = 'CUOTA '  + String(cuotas[0].Numero_Cuota).padStart(2,'0') + '/' + totalStr;
    else                    cuotasDesc = 'CUOTAS ' + cuotas.map(c => String(c.Numero_Cuota).padStart(2,'0')).join(', ') + '/' + totalStr;
    const codigosDesc  = cuotas.map(c => c.Codigo_Verificacion).join(' · ');
    const primerCodigo = nCuotas > 0 ? cuotas[0].Codigo_Verificacion : '';
    const tIdGrupo     = trx.Ticket_ID_Grupo || '';
    const montoTotal   = trx.Monto_Total || 0;
    return `
    <div style="padding:10px 0;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;">
      <div style="flex:1;min-width:0;">
        <div style="font-size:13px;font-weight:700;">${cuotasDesc} &nbsp;·&nbsp; ${fmtFecha(trx.Fecha_Pago)}</div>
        <div style="font-size:11px;color:var(--muted);word-break:break-all;">${codigosDesc}</div>
        <div style="font-size:13px;color:var(--success);font-weight:600;">COBRADO: ${fmtGs(montoTotal)}</div>
      </div>
      <div style="display:flex;flex-direction:column;gap:4px;align-items:flex-end;margin-left:8px;">
        <button onclick="reimprimirPagoGrupo('${tIdGrupo}')" style="background:var(--bg);border:1px solid var(--border);padding:6px 10px;border-radius:8px;cursor:pointer;font-size:14px;">🖨️</button>
        <button onclick="mostrarAnularPago('${tIdGrupo}','${primerCodigo}')" style="background:#fee2e2;border:none;padding:6px 10px;border-radius:8px;cursor:pointer;font-size:14px;color:#991b1b;">✕</button>
      </div>
    </div>`;
  }).join('') : '<div style="color:var(--muted);font-size:13px;padding:8px 0;">SIN PAGOS REGISTRADOS</div>';

  const modal = document.createElement('div');
  modal.id = 'modalDetalleVenta';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:5000;display:flex;align-items:flex-end;justify-content:center;';
  modal.innerHTML = `<div style="background:white;border-radius:24px 24px 0 0;padding:24px;width:100%;max-width:600px;max-height:88vh;overflow-y:auto;">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
      <div>
        <div style="font-size:18px;font-weight:800;">${venta.Numero_Pedido}</div>
        <div style="font-size:12px;color:var(--muted);">${fmtFecha(venta.Fecha_Venta)}</div>
      </div>
      <button onclick="document.getElementById('modalDetalleVenta').remove()" style="background:var(--bg);border:none;padding:8px 14px;border-radius:10px;cursor:pointer;font-size:18px;">✕</button>
    </div>
    <h4 style="margin-bottom:8px;color:var(--muted);font-size:12px;text-transform:uppercase;">Productos</h4>
    ${productosHtml||'<div class="empty">SIN PRODUCTOS</div>'}
    <div style="margin:14px 0;padding:14px;background:var(--bg);border-radius:12px;font-size:14px;">
      <div style="display:flex;justify-content:space-between;margin-bottom:5px;"><span>TOTAL VENTA:</span><strong>${fmtGs(venta.Total_Venta)}</strong></div>
      ${parseFloat(venta.Entrega_Inicial)>0?'<div style="display:flex;justify-content:space-between;margin-bottom:5px;"><span>ENTREGA INICIAL:</span><strong style="color:var(--success);">'+fmtGs(venta.Entrega_Inicial)+'</strong></div>':''}
      <div style="display:flex;justify-content:space-between;margin-bottom:5px;"><span>SALDO FINANCIADO:</span><strong>${fmtGs(venta.Saldo_Financiar)}</strong></div>
      <div style="display:flex;justify-content:space-between;margin-bottom:5px;"><span>GARANTÍA:</span><strong>${venta.Garantia_Meses||0} MESES</strong></div>
      <div style="display:flex;justify-content:space-between;border-top:2px solid var(--border);padding-top:8px;margin-top:6px;">
        <span style="font-weight:700;">SALDO ACTUAL:</span>
        <strong style="color:${venta.Saldo_Actual>0?'var(--danger)':'var(--success)'};">${fmtGs(venta.Saldo_Actual)}</strong>
      </div>
    </div>
    ${cuotas.length?'<h4 style="margin-bottom:8px;color:var(--muted);font-size:12px;text-transform:uppercase;">Cuotas</h4>'+cuotasHtml:''}
    <h4 style="margin:14px 0 8px;color:var(--muted);font-size:12px;text-transform:uppercase;">Historial de Pagos</h4>
    ${pagosHtml}
    <div style="display:flex;gap:8px;margin-top:18px;flex-wrap:wrap;">
      <button onclick="reimprimirComprobante('${idVenta}')" class="btn btn-secondary" style="flex:1;min-width:130px;font-size:13px;">🖨️ COMP. VENTA</button>
      <button onclick="imprimirEstadoCuenta('${idVenta}')" class="btn btn-secondary" style="flex:1;min-width:130px;font-size:13px;">📋 ESTADO CTA</button>
      <button onclick="mostrarAnularVenta('${idVenta}')" class="btn" style="flex:1;min-width:130px;font-size:13px;background:#ef4444;">🚫 ANULAR VENTA</button>
    </div>
    <button onclick="document.getElementById('modalDetalleVenta').remove()" class="btn btn-secondary" style="width:100%;margin-top:8px;">CERRAR</button>
  </div>`;
  modal.addEventListener('click', e=>{ if(e.target===modal) modal.remove(); });
  document.body.appendChild(modal);
}

// ============================================
// REIMPRESIÓN
// ============================================
// Reimprime el ticket unificado de un cobro (nuevo flujo con ticketIdGrupo)
async function reimprimirPagoGrupo(ticketIdGrupo) {
  if (!ticketIdGrupo) { toast('SIN TICKET GUARDADO', 'warning'); return; }
  await imprimirTicketGuardado(ticketIdGrupo);
}

// Legacy: mantener por si se llama con objeto pago antiguo
async function reimprimirPago(pago) {
  if (pago && pago.Ticket_ID) {
    await imprimirTicketGuardado(pago.Ticket_ID);
    return;
  }
  if (pago && pago.ID_Pago) {
    const cliente = APP.clientes.find(c => c.ID_Cliente === pago.ID_Cliente);
    await imprimirTicketBluetooth({
      tipo: 'pago',
      nombreCliente: pago.Nombre_Cliente,
      clienteDoc: cliente ? cliente.CI_RUC : '',
      numeroPedido: pago.ID_Venta,
      codigoVerif: pago.Codigo_Verificacion,
      montoPago: pago.Monto_Pagado,
      saldoRestante: pago.Saldo_Restante,
      proximaFecha: pago.Proxima_Fecha,
      productoDesc: pago.Producto,
      numeroCuota: pago.Numero_Cuota,
      totalCuotas: pago.Total_Cuotas,
      cobrador: pago.Cobrador,
      fechaPago: pago.Fecha_Pago
    });
  }
}

// Imprime un ticket ya guardado en TICKETS_TEMP usando su ID
async function imprimirTicketGuardado(ticketId) {
  try {
    const ticketURL = API_URL + '?action=getTicket&ticketId=' + encodeURIComponent(ticketId);
    const printURL  = 'my.bluetoothprint.scheme://' + ticketURL;
    const a = document.createElement('a');
    a.href = printURL;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => a.remove(), 500);
    toast('ENVIANDO A IMPRESORA...', 'info', 2000);
  } catch(e) {
    toast('ERROR AL ENVIAR A IMPRESORA', 'error');
    console.error('imprimirTicketGuardado error:', e);
  }
}

async function reimprimirComprobante(idVenta) {
  const ventas = await getVentasClienteAPI(APP.clienteActual.ID_Cliente);
  const venta = ventas.find(v => v.ID_Venta === idVenta);
  const detalles = await getDetalleVentaAPI(idVenta);
  if (!venta) return;
  const cliente = APP.clientes.find(c => c.ID_Cliente === APP.clienteActual.ID_Cliente);
  await imprimirTicketBluetooth({
    tipo: 'venta',
    nombreCliente: APP.clienteActual.Nombres + ' ' + APP.clienteActual.Apellidos,
    clienteDoc: cliente ? cliente.CI_RUC : '',
    numeroPedido: venta.Numero_Pedido,
    productos: detalles.map(d=>({descripcion:d.Descripcion,cantidad:d.Cantidad,precio:d.Precio_Unitario})),
    totalVenta: venta.Total_Venta,
    entregaInicial: venta.Entrega_Inicial,
    saldoFinanciar: venta.Saldo_Financiar,
    cantidadCuotas: venta.Cantidad_Cuotas,
    valorCuota: venta.Saldo_Financiar/(venta.Cantidad_Cuotas||1),
    garantiaMeses: venta.Garantia_Meses,
    vendedor: APP.user.nombre,
    fechaVenta: venta.Fecha_Venta
  });
}

// ============================================
// ANULACIONES
// ============================================
function mostrarAnularVenta(idVenta) {
  const existing = document.getElementById('modalAnulacion'); if(existing) existing.remove();
  const modal = document.createElement('div');
  modal.id = 'modalAnulacion';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:6000;display:flex;align-items:center;justify-content:center;padding:20px;';
  const optsHtml = MOTIVOS_ANULACION.map(m => `<option value="${m}">${m}</option>`).join('');
  modal.innerHTML = `<div style="background:white;border-radius:20px;padding:28px;width:100%;max-width:440px;">
    <div style="font-size:18px;font-weight:800;color:#ef4444;margin-bottom:6px;">🚫 ANULAR VENTA</div>
    <div style="font-size:13px;color:var(--muted);margin-bottom:20px;">${idVenta}</div>
    <label style="font-weight:600;display:block;margin-bottom:6px;font-size:14px;">MOTIVO DE ANULACIÓN</label>
    <select id="motivoAnulacion" style="width:100%;padding:12px;border:2px solid var(--border);border-radius:12px;font-size:14px;box-sizing:border-box;margin-bottom:12px;">${optsHtml}</select>
    <label style="font-weight:600;display:block;margin-bottom:6px;font-size:14px;">OBSERVACIÓN (OPCIONAL)</label>
    <textarea id="obsAnulacion" style="width:100%;padding:12px;border:2px solid var(--border);border-radius:12px;font-size:14px;box-sizing:border-box;min-height:80px;resize:none;" placeholder="DETALLES ADICIONALES..."></textarea>
    <div style="display:flex;gap:10px;margin-top:16px;">
      <button onclick="document.getElementById('modalAnulacion').remove()" class="btn btn-secondary" style="flex:1;">CANCELAR</button>
      <button onclick="confirmarAnularVenta('${idVenta}')" style="flex:1;padding:14px;background:#ef4444;color:white;border:none;border-radius:12px;font-size:15px;font-weight:700;cursor:pointer;">CONFIRMAR</button>
    </div>
  </div>`;
  document.body.appendChild(modal);
}

async function confirmarAnularVenta(idVenta) {
  const motivo = document.getElementById('motivoAnulacion').value;
  const obs = document.getElementById('obsAnulacion').value;
  document.getElementById('modalAnulacion').remove();
  showLoader('ANULANDO VENTA...');
  const result = await anularVentaAPI({ idVenta, motivo, observacion:obs, usuario:APP.user.nombre });
  hideLoader();
  if (result.success) {
    mostrarConfirmacion('VENTA ANULADA');
    setTimeout(()=>{ document.getElementById('modalDetalleVenta')?.remove(); verDetalleCliente(APP.clienteActual.ID_Cliente); },1900);
  } else toast(result.error||'ERROR AL ANULAR','error',4000);
}

function mostrarAnularPago(idGrupo, codigoVerif) {
  const existing = document.getElementById('modalAnulacion'); if(existing) existing.remove();
  const modal = document.createElement('div');
  modal.id = 'modalAnulacion';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:6000;display:flex;align-items:center;justify-content:center;padding:20px;';
  const optsHtml = MOTIVOS_ANULACION.map(m => `<option value="${m}">${m}</option>`).join('');
  modal.innerHTML = `<div style="background:white;border-radius:20px;padding:28px;width:100%;max-width:440px;">
    <div style="font-size:18px;font-weight:800;color:#ef4444;margin-bottom:6px;">🚫 ANULAR COBRO</div>
    <div style="font-size:12px;color:#ef4444;font-weight:600;margin-bottom:4px;">SE ANULARÁN TODOS LOS PAGOS DE ESTE COBRO</div>
    <div style="font-size:12px;color:var(--muted);margin-bottom:20px;">${codigoVerif}</div>
    <label style="font-weight:600;display:block;margin-bottom:6px;font-size:14px;">MOTIVO DE ANULACIÓN</label>
    <select id="motivoAnulacion" style="width:100%;padding:12px;border:2px solid var(--border);border-radius:12px;font-size:14px;box-sizing:border-box;margin-bottom:12px;">${optsHtml}</select>
    <label style="font-weight:600;display:block;margin-bottom:6px;font-size:14px;">OBSERVACIÓN (OPCIONAL)</label>
    <textarea id="obsAnulacion" style="width:100%;padding:12px;border:2px solid var(--border);border-radius:12px;font-size:14px;box-sizing:border-box;min-height:80px;resize:none;" placeholder="DETALLES ADICIONALES..."></textarea>
    <div style="display:flex;gap:10px;margin-top:16px;">
      <button onclick="document.getElementById('modalAnulacion').remove()" class="btn btn-secondary" style="flex:1;">CANCELAR</button>
      <button onclick="confirmarAnularPago('${idGrupo}')" style="flex:1;padding:14px;background:#ef4444;color:white;border:none;border-radius:12px;font-size:15px;font-weight:700;cursor:pointer;">CONFIRMAR</button>
    </div>
  </div>`;
  document.body.appendChild(modal);
}

async function confirmarAnularPago(idGrupo) {
  const motivo = document.getElementById('motivoAnulacion').value;
  const obs = document.getElementById('obsAnulacion').value;
  if (!motivo) { toast('SELECCIONA UN MOTIVO', 'warning'); return; }
  document.getElementById('modalAnulacion').remove();
  showLoader('ANULANDO COBRO...');
  const result = await anularPagoAPI({ idGrupo, motivo, observacion:obs, usuario:APP.user.nombre });
  hideLoader();
  if (result.success) {
    const cant = result.pagosAnulados || 1;
    mostrarConfirmacion(cant > 1 ? cant + ' PAGOS ANULADOS' : 'PAGO ANULADO');
    setTimeout(()=>{ 
      const mv = document.getElementById('modalDetalleVenta'); 
      if(mv) mv.remove();
      if(APP.clienteActual) verDetalleCliente(APP.clienteActual.ID_Cliente);
    },1900);
  } else toast(result.error||'ERROR AL ANULAR','error',4000);
}

// ============================================
// FORM CLIENTE
// ============================================
function showFormCliente() {
  hideAll();
  document.getElementById('formClientePage').classList.remove('hidden');
  document.getElementById('tituloFormCliente').textContent = 'NUEVO CLIENTE';
  document.getElementById('formCliente').reset();
  document.getElementById('ciudadOtroDiv').style.display='none';
  ['ciRuc','nombres','apellidos','alias','recomendadoPor'].forEach(id=>{ const el=document.getElementById(id); if(el) el.disabled=false; });
  const gp = document.getElementById('gpsPreview'); if(gp) { gp.innerHTML=''; gp.style.display='none'; }
  APP.modoEdicion = false; APP.clienteActual = null;
}
document.getElementById('telefono').addEventListener('input', function(){
  let v = this.value.replace(/[^0-9]/g,'');
  if (v.length>=1 && v[0]!=='0') v='0'+v;
  if (v.length>=2 && v[1]!=='9') v=v[0]+'9'+v.substring(1);
  v=v.substring(0,10);
  if (v.length<=4) this.value=v;
  else if (v.length<=7) this.value=v.substring(0,4)+'-'+v.substring(4);
  else this.value=v.substring(0,4)+'-'+v.substring(4,7)+'-'+v.substring(7,10);
});
document.getElementById('ciudadSelect').addEventListener('change', function(){
  const d=document.getElementById('ciudadOtroDiv');
  if (this.value==='OTRO') { d.style.display='block'; document.getElementById('ciudadOtro').focus(); }
  else d.style.display='none';
});
function obtenerGPS() {
  if (!navigator.geolocation) { toast('GPS NO DISPONIBLE','error'); return; }
  toast('OBTENIENDO UBICACIÓN...','info',2000);
  navigator.geolocation.getCurrentPosition(
    pos => {
      const lat = pos.coords.latitude, lng = pos.coords.longitude;
      document.getElementById('gpsLat').value = lat.toFixed(7);
      document.getElementById('gpsLng').value = lng.toFixed(7);
      toast('GPS: '+lat.toFixed(4)+', '+lng.toFixed(4),'success',4000);
      const prev = document.getElementById('gpsPreview');
      if (prev) {
        prev.innerHTML = `<a href="https://www.google.com/maps?q=${lat},${lng}" target="_blank" style="color:var(--accent);font-size:13px;">📍 VER EN MAPA: ${lat.toFixed(5)}, ${lng.toFixed(5)}</a>`;
        prev.style.display='block';
      }
    },
    err => {
      const msgs={1:'PERMISO DENEGADO.',2:'POSICIÓN NO DISPONIBLE.',3:'TIEMPO AGOTADO.'};
      toast(msgs[err.code]||'ERROR GPS','error',4000);
    },
    { enableHighAccuracy:true, timeout:15000, maximumAge:0 }
  );
}
document.getElementById('formCliente').addEventListener('submit', async function(e){
  e.preventDefault();
  const ciudadSel = document.getElementById('ciudadSelect').value;
  const ciudadFinal = ciudadSel==='OTRO' ? mayus(document.getElementById('ciudadOtro').value) : ciudadSel;
  const tel = document.getElementById('telefono').value;
  const datos = {
    ciRuc: mayus(document.getElementById('ciRuc').value),
    nombres: mayus(document.getElementById('nombres').value),
    apellidos: mayus(document.getElementById('apellidos').value),
    telefono: tel, telWhatsApp: formatTelWA(tel),
    direccion: mayus(document.getElementById('direccion').value),
    ciudad: ciudadFinal,
    barrio: mayus(document.getElementById('barrio').value),
    referencia: mayus(document.getElementById('referencia').value),
    gpsLat: document.getElementById('gpsLat').value,
    gpsLng: document.getElementById('gpsLng').value,
    alias: mayus(document.getElementById('alias').value),
    recomendadoPor: mayus(document.getElementById('recomendadoPor').value)
  };
  const btn = this.querySelector('button[type=submit]');
  btn.disabled=true; btn.textContent='GUARDANDO...';
  showLoader('GUARDANDO CLIENTE...');
  let result;
  if (APP.modoEdicion) { datos.id=APP.clienteActual.ID_Cliente; result=await updateClienteAPI(datos); }
  else result = await saveClienteAPI(datos);
  hideLoader(); btn.disabled=false; btn.textContent='GUARDAR CLIENTE';
  if (result.success) { mostrarConfirmacion(APP.modoEdicion?'CLIENTE ACTUALIZADO':'CLIENTE GUARDADO'); setTimeout(()=>showClientes(),1800); }
  else toast(result.error,'error',4000);
});
function editarCliente() {
  hideAll();
  document.getElementById('formClientePage').classList.remove('hidden');
  document.getElementById('tituloFormCliente').textContent = 'EDITAR CLIENTE';
  APP.modoEdicion = true;
  const c = APP.clienteActual;
  document.getElementById('ciRuc').value=c.CI_RUC; document.getElementById('ciRuc').disabled=true;
  document.getElementById('nombres').value=c.Nombres; document.getElementById('nombres').disabled=true;
  document.getElementById('apellidos').value=c.Apellidos; document.getElementById('apellidos').disabled=true;
  document.getElementById('telefono').value=c.Telefono||'';
  document.getElementById('direccion').value=c.Direccion||'';
  document.getElementById('barrio').value=c.Barrio||'';
  document.getElementById('referencia').value=c.Referencia||'';
  document.getElementById('gpsLat').value=c.GPS_Lat||'';
  document.getElementById('gpsLng').value=c.GPS_Lng||'';
  document.getElementById('alias').value=c.Alias||''; document.getElementById('alias').disabled=true;
  document.getElementById('recomendadoPor').value=c.Recomendado_Por||''; document.getElementById('recomendadoPor').disabled=true;
  const sel=document.getElementById('ciudadSelect');
  const ciudadExiste=CIUDADES_PY.includes(c.Ciudad);
  if (ciudadExiste) sel.value=c.Ciudad||'';
  else if (c.Ciudad) { sel.value='OTRO'; document.getElementById('ciudadOtroDiv').style.display='block'; document.getElementById('ciudadOtro').value=c.Ciudad; }
}
function nuevaVentaDesdeCliente() { APP.ventaClientePreseleccionado=APP.clienteActual; showVentas(); }

// ============================================
// VENTAS
// ============================================
async function showVentas() {
  hideAll();
  document.getElementById('ventasPage').classList.remove('hidden');
  if (!APP.clientes.length) APP.clientes = await getClientesAPI();
  const fechaEl = document.getElementById('ventaFecha');
  if (fechaEl) fechaEl.value = new Date().toISOString().substring(0, 10);
  renderBuscadorClientes('ventaClienteBusca','ventaClienteId','ventaClienteNombreHidden');
  if (APP.ventaClientePreseleccionado) {
    const vc = APP.ventaClientePreseleccionado;
    document.getElementById('ventaClienteBusca').value = vc.Nombres+' '+vc.Apellidos+' - '+vc.CI_RUC;
    document.getElementById('ventaClienteId').value = vc.ID_Cliente;
    document.getElementById('ventaClienteNombreHidden').value = vc.Nombres+' '+vc.Apellidos;
    APP.ventaClientePreseleccionado = null;
  }
  APP.ventaActual = []; renderCarrito();
}

function renderBuscadorClientes(inputId, hiddenIdId, hiddenNombreId) {
  const input = document.getElementById(inputId);
  const hiddenId = document.getElementById(hiddenIdId);
  const hiddenNombre = document.getElementById(hiddenNombreId);
  if (!input) return;
  input.value=''; hiddenId.value=''; if(hiddenNombre) hiddenNombre.value='';
  const prevDD = document.getElementById(inputId+'_dd'); if(prevDD) prevDD.remove();
  const dropdown = document.createElement('div');
  dropdown.id = inputId+'_dd';
  dropdown.style.cssText = 'display:none;position:absolute;z-index:3000;background:white;border:2px solid var(--border);border-radius:12px;max-height:220px;overflow-y:auto;width:100%;box-shadow:0 8px 24px rgba(0,0,0,0.15);';
  input.parentElement.style.position='relative';
  input.parentElement.appendChild(dropdown);
  function showDD(q) {
    const filtered = APP.clientes.filter(c =>
      (c.Nombres+' '+c.Apellidos).includes(q.toUpperCase()) ||
      String(c.CI_RUC).includes(q) ||
      String(c.Alias||'').includes(q.toUpperCase())
    ).slice(0,15);
    if (!filtered.length) { dropdown.style.display='none'; return; }
    dropdown.innerHTML = filtered.map(c => `
      <div onclick="window['sel_${inputId}']('${c.ID_Cliente}')" style="padding:12px 16px;cursor:pointer;border-bottom:1px solid var(--border);" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='white'">
        <div style="font-weight:600;">${c.Nombres} ${c.Apellidos}${c.Alias?' "'+c.Alias+'"':''}</div>
        <div style="font-size:12px;color:var(--muted);">CI: ${c.CI_RUC} · ${c.Telefono||'SIN TEL'}</div>
      </div>`).join('');
    dropdown.style.display='block';
  }
  window['sel_'+inputId] = function(id) {
    const c = APP.clientes.find(x=>x.ID_Cliente===id); if(!c) return;
    input.value = c.Nombres+' '+c.Apellidos+' - CI: '+c.CI_RUC;
    hiddenId.value = c.ID_Cliente;
    if(hiddenNombre) hiddenNombre.value = c.Nombres+' '+c.Apellidos;
    dropdown.style.display='none';
  };
  input.addEventListener('input',()=>{ if(input.value.length>=1) showDD(input.value); else dropdown.style.display='none'; });
  input.addEventListener('focus',()=>{ if(input.value.length>=1) showDD(input.value); });
  document.addEventListener('click',e=>{ if(!input.contains(e.target)&&!dropdown.contains(e.target)) dropdown.style.display='none'; });
}

function renderCarrito() {
  const items = APP.ventaActual;
  let total = 0;
  if (!items.length) {
    document.getElementById('carritoItems').innerHTML='<div class="empty">CARRITO VACÍO</div>';
    document.getElementById('carritoTotal').textContent=fmtGs(0);
    document.getElementById('ventaTotalInput').value=0; return;
  }
  let html='';
  items.forEach((item,idx)=>{
    const sub = item.cantidad*item.precio; total+=sub;
    html+=`<div class="carrito-item">
      <div class="item-desc">${item.descripcion}</div>
      <div class="item-info">
        <span>${item.cantidad} X ${fmtGs(item.precio)} = ${fmtGs(sub)}</span>
        ${item.costo>0?'<span style="color:var(--muted);font-size:12px;">COSTO: '+fmtGs(item.costo)+'</span>':''}
        <button onclick="eliminarItemCarrito(${idx})" class="btn-delete">🗑️</button>
      </div>
    </div>`;
  });
  document.getElementById('carritoItems').innerHTML=html;
  document.getElementById('carritoTotal').textContent=fmtGs(total);
  document.getElementById('ventaTotalInput').value=total;
}
function agregarItemCarrito() {
  const desc = mayus(document.getElementById('itemDesc').value.trim());
  const cant = parseInt(document.getElementById('itemCantidad').value)||1;
  const precio = parseFloat(document.getElementById('itemPrecio').value)||0;
  const costo = parseFloat(document.getElementById('itemCosto').value)||0;
  if (!desc) { toast('INGRESÁ LA DESCRIPCIÓN','warning'); return; }
  if (precio<=0) { toast('INGRESÁ UN PRECIO VÁLIDO','warning'); return; }
  APP.ventaActual.push({descripcion:desc,cantidad:cant,precio,costo});
  document.getElementById('itemDesc').value='';
  document.getElementById('itemCantidad').value='1';
  document.getElementById('itemPrecio').value='';
  document.getElementById('itemCosto').value='';
  renderCarrito(); toast('PRODUCTO AGREGADO','success',1500);
}
function eliminarItemCarrito(idx) { APP.ventaActual.splice(idx,1); renderCarrito(); }
document.getElementById('formVenta').addEventListener('submit', async function(e){
  e.preventDefault();
  const idCliente = document.getElementById('ventaClienteId').value;
  const nombreCliente = document.getElementById('ventaClienteNombreHidden').value;
  if (!idCliente) { toast('SELECCIONÁ UN CLIENTE','warning'); return; }
  if (!APP.ventaActual.length) { toast('AGREGÁ AL MENOS UN PRODUCTO','warning'); return; }
  const btn = this.querySelector('button[type=submit]');
  btn.disabled=true; btn.textContent='GUARDANDO...';
  showLoader('REGISTRANDO VENTA...');
  const datos = {
    idCliente, nombreCliente, productos:APP.ventaActual,
    totalVenta: parseFloat(document.getElementById('ventaTotalInput').value),
    entregaInicial: parseFloat(document.getElementById('ventaEntrega').value)||0,
    cantidadCuotas: parseInt(document.getElementById('ventaCuotas').value)||0,
    diasPrimeraCuota: parseInt(document.getElementById('ventaDias').value)||30,
    garantiaMeses: parseInt(document.getElementById('ventaGarantia').value)||0,
    fechaVenta: (()=>{
      const d = document.getElementById('ventaFecha');
      const s = d ? d.value : '';
      if (!s) return new Date().toISOString();
      return s + 'T' + new Date().toTimeString().substring(0,8);
    })(),
    vendedor: APP.user.nombre
  };
  const result = await saveVentaAPI(datos);
  hideLoader(); btn.disabled=false; btn.textContent='💾 REGISTRAR VENTA';
  if (result.success) {
    mostrarConfirmacion('VENTA REGISTRADA');
    setTimeout(async()=>{
      const cliente = APP.clientes.find(c => c.ID_Cliente === datos.idCliente);
      await imprimirTicketBluetooth({
        tipo:'venta',
        nombreCliente: datos.nombreCliente,
        clienteDoc: cliente ? cliente.CI_RUC : '',
        numeroPedido: result.numeroPedido,
        productos: datos.productos,
        totalVenta: datos.totalVenta,
        entregaInicial: datos.entregaInicial,
        saldoFinanciar: result.saldoFinanciar,
        cantidadCuotas: datos.cantidadCuotas,
        valorCuota: result.valorCuota,
        garantiaMeses: datos.garantiaMeses,
        fechaPrimeraCuota: result.fechaPrimeraCuota,
        vendedor: datos.vendedor,
        fechaVenta: datos.fechaVenta
      });
      setTimeout(()=>showDashboard(),3000);
    },1900);
  } else toast(result.error,'error',4000);
});

// ============================================
// LISTADO DE VENTAS
// ============================================
async function showListadoVentas() {
  hideAll();
  document.getElementById('listadoVentasPage').classList.remove('hidden');
  document.getElementById('todasVentas').innerHTML = '<div class="loading">CARGANDO...</div>';
  const ventas = await getVentasAPI();
  renderTodasVentas(ventas);
}

function renderTodasVentas(ventas) {
  if (!ventas.length) {
    document.getElementById('todasVentas').innerHTML='<div class="empty">NO HAY VENTAS</div>'; return;
  }
  // Ordenar por fecha descendente
  ventas.sort((a,b) => new Date(b.Fecha_Venta) - new Date(a.Fecha_Venta));
  let html = '';
  ventas.forEach(v => {
    const saldoColor = v.Saldo_Actual > 0 ? 'var(--danger)' : 'var(--success)';
    const estadoBadge = v.Saldo_Actual > 0 ? 'badge-warning' : 'badge-ok';
    const estadoText = v.Saldo_Actual > 0 ? 'PENDIENTE' : 'PAGADO';
    html += `<div class="card">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;">
        <div style="flex:1;">
          <div class="card-title">${v.Numero_Pedido} <span class="badge ${estadoBadge}">${estadoText}</span></div>
          <div class="card-info" style="font-weight:600;color:var(--text);">👤 ${v.Cliente_Nombre}</div>
          <div class="card-info" style="font-weight:500;">📦 ${v.Productos||'SIN PRODUCTOS'}</div>
          <div class="card-info">📅 ${fmtFecha(v.Fecha_Venta)}</div>
          <div style="display:flex;gap:20px;margin-top:8px;flex-wrap:wrap;">
            <div class="card-info" style="background:var(--bg);padding:6px 12px;border-radius:8px;">
              <span style="color:var(--muted);font-size:12px;">TOTAL:</span>
              <strong style="margin-left:6px;">${fmtGs(v.Total_Venta)}</strong>
            </div>
            ${parseFloat(v.Entrega_Inicial)>0?'<div class="card-info" style="background:var(--bg);padding:6px 12px;border-radius:8px;"><span style="color:var(--muted);font-size:12px;">ENTREGA:</span><strong style="margin-left:6px;color:var(--success);">'+fmtGs(v.Entrega_Inicial)+'</strong></div>':''}
            ${v.Cantidad_Cuotas>0?'<div class="card-info" style="background:var(--bg);padding:6px 12px;border-radius:8px;"><span style="color:var(--muted);font-size:12px;">CUOTAS:</span><strong style="margin-left:6px;">'+v.Cantidad_Cuotas+'</strong></div>':''}
            <div class="card-info" style="background:${v.Saldo_Actual>0?'#fee2e2':'#d1fae5'};padding:6px 12px;border-radius:8px;">
              <span style="color:var(--muted);font-size:12px;">SALDO:</span>
              <strong style="margin-left:6px;color:${saldoColor};">${fmtGs(v.Saldo_Actual)}</strong>
            </div>
          </div>
        </div>
      </div>
    </div>`;
  });
  document.getElementById('todasVentas').innerHTML = html;
}

function buscarVentas() {
  const q = document.getElementById('searchVentas').value.toUpperCase();
  getVentasAPI().then(ventas => {
    const filtradas = ventas.filter(v =>
      v.Numero_Pedido.includes(q) ||
      v.Cliente_Nombre.includes(q) ||
      String(v.Productos||'').includes(q) ||
      fmtFecha(v.Fecha_Venta).includes(q)
    );
    renderTodasVentas(filtradas);
  });
}

// ============================================
// COBRANZAS - vencidas agrupadas por cliente
// ============================================
async function showCobranzas() {
  hideAll();
  document.getElementById('cobranzasPage').classList.remove('hidden');
  if (!APP.clientes.length) APP.clientes = await getClientesAPI();
  renderBuscadorClientes('cobranzaClienteBusca','cobranzaClienteId','cobranzaClienteNombreHidden');
  document.getElementById('cuotasVencidas').innerHTML='<div class="loading">CARGANDO...</div>';
  document.getElementById('cuotasCliente').innerHTML='';
  const clientesAtraso = await getClientesConAtrasoAPI();
  renderClientesConAtraso(clientesAtraso);
}

function renderClientesConAtraso(lista) {
  if (!lista.length) {
    document.getElementById('cuotasVencidas').innerHTML='<div class="empty">✅ NO HAY CUOTAS VENCIDAS</div>'; return;
  }
  let html = '';
  lista.forEach(c => {
    const diasColor = c.MaxDiasAtraso > 30 ? 'var(--danger)' : c.MaxDiasAtraso > 7 ? '#f59e0b' : 'var(--text)';
    const waNum = formatTelWA(c.TelWA || c.Telefono);
    html += `<div class="card" style="border-left:3px solid var(--danger);" onclick="cargarClienteCobranza('${c.ID_Cliente}','${c.Nombre}')">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;">
        <div style="flex:1;">
          <div class="card-title">${c.Nombre}</div>
          <div class="card-info">📱 ${c.Telefono||'SIN TEL'}</div>
          <div class="card-info">
            <span style="color:var(--danger);font-weight:700;">${c.CuotasVencidas} CUOTA${c.CuotasVencidas>1?'S':''} VENCIDA${c.CuotasVencidas>1?'S':''}</span>
            · <span style="font-weight:700;">${fmtGs(c.SaldoTotal)}</span>
          </div>
          <div class="card-info" style="color:${diasColor};font-weight:600;">⏱️ ${c.MaxDiasAtraso} DÍAS DE ATRASO MÁX.</div>
        </div>
        ${waNum?`<a href="https://wa.me/${waNum}" onclick="event.stopPropagation()" style="background:#25D366;color:white;border-radius:10px;padding:8px 12px;font-size:20px;text-decoration:none;flex-shrink:0;">💬</a>`:''}
      </div>
    </div>`;
  });
  document.getElementById('cuotasVencidas').innerHTML = html;
}

function cargarClienteCobranza(idCliente, nombre) {
  // Pre-seleccionar cliente en el buscador y cargar sus cuotas
  const busca = document.getElementById('cobranzaClienteBusca');
  const hiddenId = document.getElementById('cobranzaClienteId');
  const hiddenNombre = document.getElementById('cobranzaClienteNombreHidden');
  if (busca) busca.value = nombre;
  if (hiddenId) hiddenId.value = idCliente;
  if (hiddenNombre) hiddenNombre.value = nombre;
  cargarCuotasCliente();
  // Scroll al buscador
  document.getElementById('cobranzaClienteBusca')?.scrollIntoView({behavior:'smooth',block:'start'});
}

function buscarClienteCobranza() { cargarCuotasCliente(); }

async function cargarCuotasCliente() {
  const idCliente = document.getElementById('cobranzaClienteId').value;
  if (!idCliente) { 
    document.getElementById('cuotasCliente').innerHTML=''; 
    document.getElementById('selectorProducto').innerHTML='';
    return; 
  }
  document.getElementById('cuotasCliente').innerHTML='<div class="loading">CARGANDO...</div>';
  
  // Obtener ventas y cuotas del cliente
  const [ventas, cuotas] = await Promise.all([
    getVentasClienteAPI(idCliente),
    getCuotasClienteAPI(idCliente)
  ]);
  
  // Si tiene múltiples ventas con saldo, mostrar selector
  const ventasConSaldo = ventas.filter(v => v.Saldo_Actual > 0);
  if (ventasConSaldo.length > 1) {
    let selectorHtml = '<div style="background:var(--white);padding:16px 20px;border-radius:16px;box-shadow:var(--shadow);margin-bottom:16px;">';
    selectorHtml += '<label style="display:block;margin-bottom:8px;font-size:12px;font-weight:600;color:var(--muted);text-transform:uppercase;">FILTRAR POR PRODUCTO</label>';
    selectorHtml += '<select id="filtroProducto" onchange="filtrarCuotasPorProducto()" style="width:100%;padding:12px;border:2px solid var(--border);border-radius:10px;font-size:15px;">';
    selectorHtml += '<option value="">TODAS LAS CUOTAS</option>';
    ventasConSaldo.forEach(v => {
      selectorHtml += `<option value="${v.ID_Venta}">${v.Productos} - SALDO: ${fmtGs(v.Saldo_Actual)}</option>`;
    });
    selectorHtml += '</select></div>';
    document.getElementById('selectorProducto').innerHTML = selectorHtml;
  } else {
    document.getElementById('selectorProducto').innerHTML = '';
  }
  
  APP.cuotasActuales = cuotas;
  renderCuotasCobranza(cuotas);
}

function filtrarCuotasPorProducto() {
  const filtro = document.getElementById('filtroProducto').value;
  if (!filtro) {
    renderCuotasCobranza(APP.cuotasActuales);
  } else {
    const filtradas = APP.cuotasActuales.filter(c => c.ID_Venta === filtro);
    renderCuotasCobranza(filtradas);
  }
}

function renderCuotasCobranza(cuotas) {
  if (!cuotas.length) { 
    document.getElementById('cuotasCliente').innerHTML='<div class="empty">SIN CUOTAS</div>'; 
    return; 
  }
  let html='';
  cuotas.forEach(c=>{
    const bc = c.Estado==='PAGADA'?'badge-ok':c.Estado==='PARCIAL'?'badge-warning':'badge-danger';
    const label = c.Estado==='PAGADA'?'PAGADA':c.Estado==='PARCIAL'?'PARCIAL':'PENDIENTE';
    html+=`<div class="card" style="${c.Estado==='PAGADA'?'opacity:0.6':''}">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <div>
          <div class="card-title">CUOTA ${c.Numero_Cuota}/${c.Total_Cuotas} <span class="badge ${bc}">${label}</span></div>
          <div class="card-info">MONTO: ${fmtGs(c.Monto_Cuota)}</div>
          ${parseFloat(c.Monto_Pagado)>0?'<div class="card-info" style="color:var(--success);">PAGADO: '+fmtGs(c.Monto_Pagado)+'</div>':''}
          <div class="card-info">SALDO: ${fmtGs(c.Saldo_Cuota)} · VENCE: ${fmtFecha(c.Fecha_Vencimiento)}</div>
        </div>
      </div>
      ${c.Estado!=='PAGADA'?`<button onclick="mostrarModalPago('${c.ID_Cuota}',${c.Saldo_Cuota},'${c.ID_Venta}',${c.Numero_Cuota},${c.Total_Cuotas})" class="btn btn-success" style="margin-top:10px;width:100%;">💰 REGISTRAR PAGO</button>`:''}
    </div>`;
  });
  document.getElementById('cuotasCliente').innerHTML=html;
}


function mostrarModalPago(idCuota, saldo, idVenta, numeroCuota, totalCuotas) {
  const existing = document.getElementById('modalPago'); if(existing) existing.remove();
  const modal = document.createElement('div');
  modal.id = 'modalPago';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:5000;display:flex;align-items:flex-end;justify-content:center;';
  // Guardar datos de cuota para usar en confirmarPago
  APP.cuotaActual = {numeroCuota, totalCuotas};
  modal.innerHTML = `<div style="background:white;border-radius:24px 24px 0 0;padding:24px;width:100%;max-width:500px;">
    <h3 style="margin-bottom:16px;">💰 REGISTRAR PAGO</h3>
    <div style="margin-bottom:12px;">
      <label style="font-weight:600;display:block;margin-bottom:4px;font-size:14px;">CUOTA ${numeroCuota}/${totalCuotas}</label>
      <label style="font-weight:600;display:block;margin-bottom:8px;color:var(--danger);font-size:14px;">SALDO PENDIENTE: ${fmtGs(saldo)}</label>
      <label style="font-size:13px;color:var(--muted);display:block;margin-bottom:4px;">MONTO RECIBIDO</label>
      <input type="text" id="montoPagoInput" oninput="formatearMiles(this)" value="${saldo}" step="1000" style="width:100%;padding:14px;border:2px solid var(--border);border-radius:12px;font-size:16px;box-sizing:border-box;">
    </div>
    <div style="margin-bottom:16px;">
      <label style="font-size:13px;color:var(--muted);display:block;margin-bottom:4px;">FECHA DEL PAGO</label>
      <input type="date" id="fechaPagoInput" style="width:100%;padding:14px;border:2px solid var(--border);border-radius:12px;font-size:15px;box-sizing:border-box;">
    </div>
    <div style="display:flex;gap:10px;">
      <button onclick="document.getElementById('modalPago').remove()" class="btn btn-secondary" style="flex:1;">CANCELAR</button>
      <button onclick="confirmarPago('${idCuota}','${idVenta}',${saldo})" class="btn btn-success" style="flex:1;">CONFIRMAR</button>
    </div>
  </div>`;
  document.body.appendChild(modal);
  document.getElementById('fechaPagoInput').value = new Date().toISOString().substring(0, 10);
}

async function confirmarPago(idCuota, idVenta, saldo) {
  const input      = document.getElementById('montoPagoInput');
  const fechaInput = document.getElementById('fechaPagoInput');
  const montoPago  = obtenerValorNumerico(input);

  let fechaPago;
  if (!fechaInput || !fechaInput.value) {
    fechaPago = new Date().toISOString();
  } else {
    const ahora = new Date();
    fechaPago   = fechaInput.value + 'T' + ahora.toTimeString().substring(0,8);
  }
  if (!montoPago || montoPago <= 0) { toast('INGRESÁ UN MONTO VÁLIDO','warning'); return; }

  const modal = document.getElementById('modalPago'); if(modal) modal.remove();
  showLoader('REGISTRANDO PAGO...');
  const selectId     = document.getElementById('cobranzaClienteId');
  const selectNombre = document.getElementById('cobranzaClienteNombreHidden');
  const datos = {
    idCuota, montoPago, idVenta,
    idCliente:    selectId     ? selectId.value     : '',
    nombreCliente: selectNombre ? selectNombre.value : '',
    cobrador: APP.user.nombre, fechaPago
  };
  const result = await registrarPagoAPI(datos);
  hideLoader();

  if (result.success) {
    const cant    = (result.pagosGenerados || []).length;
    const mensaje = cant > 1 ? cant + ' CUOTAS PROCESADAS' : 'PAGO REGISTRADO';
    mostrarConfirmacion(mensaje);

    setTimeout(async () => {
      // El backend ya construyó y guardó el ticket unificado — solo lo enviamos a imprimir
      if (result.ticketIdGrupo) {
        await imprimirTicketGuardado(result.ticketIdGrupo);
      }
      setTimeout(() => cargarCuotasCliente(), 2000);
    }, 1900);
  } else toast(result.error || 'ERROR AL REGISTRAR PAGO', 'error', 4000);
}


window.addEventListener('load', async function() {
  const sesion = recuperarSesion();
  if (sesion) { APP.user = sesion; await showDashboard(); return; }
  const usuarios = await getUsuariosAPI();
  const select = document.getElementById('usuario');
  if (!usuarios.length) { toast('NO SE PUDO CARGAR USUARIOS','error',5000); return; }
  usuarios.forEach(u => {
    const opt = document.createElement('option');
    opt.value = u.nombre; opt.textContent = u.nombre + ' (' + u.rol + ')';
    select.appendChild(opt);
  });
});

document.getElementById('pin').addEventListener('input', function(){ this.value = this.value.replace(/[^0-9]/g,''); });

document.getElementById('loginForm').addEventListener('submit', async function(e) {
  e.preventDefault();
  const nombre = document.getElementById('usuario').value;
  const pin = document.getElementById('pin').value;
  const btn = this.querySelector('button[type=submit]');
  btn.textContent = 'INGRESANDO...'; btn.disabled = true;
  const result = await validarUsuarioAPI(nombre, pin);
  btn.textContent = 'INGRESAR'; btn.disabled = false;
  if (result.success) {
    APP.user = result.data; guardarSesion(APP.user); await showDashboard();
  } else {
    const err = document.getElementById('errorMsg');
    err.textContent = result.error; err.classList.add('show');
    toast(result.error, 'error');
  }
});
function logout() { if (confirm('¿CERRAR SESIÓN?')) cerrarSesion(); }



async function imprimirEstadoCuenta(idVenta) {
  const ventas = await getVentasClienteAPI(APP.clienteActual.ID_Cliente);
  const venta = ventas.find(v => v.ID_Venta === idVenta);
  const detalles = await getDetalleVentaAPI(idVenta);
  const cuotas = await getCuotasVentaAPI(idVenta);
  const pagos = await getPagosVentaAPI(idVenta);
  if (!venta) return;
  
  // Calcular fecha de última cuota para pagaré
  const ultimaCuota = cuotas.length > 0 ? cuotas[cuotas.length - 1] : null;
  const fechaPagare = ultimaCuota ? ultimaCuota.Fecha_Vencimiento : '';
  
  // Calcular próxima fecha pendiente
  const cuotasPendientes = cuotas.filter(c => c.Estado === 'PENDIENTE' || c.Estado === 'PARCIAL')
    .sort((a,b) => new Date(a.Fecha_Vencimiento) - new Date(b.Fecha_Vencimiento));
  const proximaFecha = cuotasPendientes.length > 0 ? cuotasPendientes[0].Fecha_Vencimiento : '';
  
  const cliente = APP.clientes.find(c => c.ID_Cliente === APP.clienteActual.ID_Cliente);
  await imprimirTicketBluetooth({
    tipo: 'estadoCuenta',
    nombreCliente: APP.clienteActual.Nombres + ' ' + APP.clienteActual.Apellidos,
    clienteDoc: cliente ? cliente.CI_RUC : '',
    numeroPedido: venta.Numero_Pedido,
    productoDesc: venta.Productos,
    totalVenta: venta.Total_Venta,
    saldoRestante: venta.Saldo_Actual,
    pagos: pagos,
    proximaFecha: proximaFecha,
    fechaPagare: fechaPagare,
    impresoPor: APP.user ? APP.user.nombre : 'SISTEMA'
  });
}


console.log('🚀 TECH MARKET v4.0');


// ============================================
// VERIFICADOR DE CODIGOS - 3 modos
// ============================================

let _modoVerif = 'camara'; // camara | texto | lector
let _lectorBuffer = '';
let _lectorTimer  = null;

async function showVerificador() {
  hideAll();
  document.getElementById('verificadorPage').classList.remove('hidden');
  document.getElementById('resultadoVerificacion').innerHTML = '';
  setModoVerificador('camara');
}

function salirVerificador() {
  detenerEscaner();
  showDashboard();
}

function setModoVerificador(modo) {
  _modoVerif = modo;
  detenerEscaner();

  // Resetear botones
  ['camara','texto','lector'].forEach(m => {
    const btn = document.getElementById('modoBtn_' + m);
    const div = document.getElementById('modo_' + m);
    if (btn) { btn.className = m === modo ? 'btn' : 'btn btn-secondary'; btn.style.flex='1'; btn.style.fontSize='13px'; btn.style.padding='10px 6px'; }
    if (div) div.style.display = m === modo ? 'block' : 'none';
  });

  document.getElementById('resultadoVerificacion').innerHTML = '';

  if (modo === 'camara') {
    iniciarEscanerQR();
  } else if (modo === 'lector') {
    const inp = document.getElementById('lectorInput');
    const st  = document.getElementById('lectorStatus');
    if (inp) { inp.value = ''; inp.focus(); }
    if (st)  st.textContent = 'Esperando escaneo...';
    _lectorBuffer = '';
  } else {
    // texto: limpiar e enfocar
    const inp = document.getElementById('codigoVerifInput');
    if (inp) { inp.value = ''; setTimeout(() => inp.focus(), 100); }
  }
}

// ---- MODO CAMARA ----
function iniciarEscanerQR() {
  const video  = document.getElementById('qrVideo');
  const canvas = document.getElementById('qrCanvas');
  const status = document.getElementById('qrStatus');
  if (!video || !canvas) return;

  if (APP.qrStream) { APP.qrStream.getTracks().forEach(t => t.stop()); APP.qrStream = null; }
  APP.qrScanning = false;

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    if (status) status.textContent = 'Cámara no disponible';
    return;
  }
  navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
    .then(stream => {
      APP.qrStream    = stream;
      video.srcObject = stream;
      video.play();
      APP.qrScanning  = true;
      if (status) status.textContent = 'Apuntá la cámara al código de barras';
      escanearFrames(video, canvas, status);
    })
    .catch(() => {
      if (status) status.textContent = 'Cámara no disponible — usá otro modo';
    });
}

function escanearFrames(video, canvas, status) {
  if (!APP.qrScanning) return;
  if (video.readyState === video.HAVE_ENOUGH_DATA) {
    canvas.width  = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    try {
      const img  = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = typeof jsQR === 'function'
        ? jsQR(img.data, img.width, img.height, { inversionAttempts: 'attemptBoth' })
        : null;
      if (code && code.data && code.data.trim()) {
        APP.qrScanning = false;
        if (APP.qrStream) { APP.qrStream.getTracks().forEach(t => t.stop()); APP.qrStream = null; }
        const cod = code.data.trim().toUpperCase();
        document.getElementById('codigoVerifInput') && (document.getElementById('codigoVerifInput').value = cod);
        if (status) status.textContent = '✅ Detectado: ' + cod;
        ejecutarVerificacion(cod);
        return;
      }
    } catch(e) {}
  }
  requestAnimationFrame(() => escanearFrames(video, canvas, status));
}

function detenerEscaner() {
  APP.qrScanning = false;
  if (APP.qrStream) { APP.qrStream.getTracks().forEach(t => t.stop()); APP.qrStream = null; }
}

// ---- MODO LECTOR USB (HID) ----
// Los lectores USB simulan teclado: mandan caracteres rapido y terminan con Enter
function lectorKeyHandler(event) {
  const st = document.getElementById('lectorStatus');
  if (event.key === 'Enter') {
    const cod = _lectorBuffer.trim().toUpperCase();
    _lectorBuffer = '';
    if (st) st.textContent = '✅ Detectado: ' + cod;
    if (cod) ejecutarVerificacion(cod);
  } else if (event.key.length === 1) {
    _lectorBuffer += event.key;
    if (st) st.textContent = 'Escaneando: ' + _lectorBuffer;
    // Timeout: si pasa 500ms sin mas chars, procesar igual
    clearTimeout(_lectorTimer);
    _lectorTimer = setTimeout(() => {
      const cod = _lectorBuffer.trim().toUpperCase();
      _lectorBuffer = '';
      if (cod && cod.length > 5) {
        if (st) st.textContent = '✅ Detectado: ' + cod;
        ejecutarVerificacion(cod);
      }
    }, 500);
  }
}

// ---- VERIFICACION COMUN ----
async function ejecutarVerificacion(codigoParam) {
  const input  = document.getElementById('codigoVerifInput');
  const codigo = (codigoParam || (input ? input.value : '')).trim().toUpperCase();
  if (!codigo) { toast('INGRESÁ UN CÓDIGO', 'warning'); return; }

  const res = document.getElementById('resultadoVerificacion');
  res.innerHTML = '<div style="text-align:center;padding:24px;color:var(--muted);font-size:15px;">⏳ VERIFICANDO...</div>';

  const r = await verificarCodigoAPI(codigo);

  if (!r.success) {
    res.innerHTML = `<div style="background:#fee2e2;border-radius:14px;padding:20px;text-align:center;">
      <div style="font-size:40px;">❌</div>
      <div style="font-weight:800;color:#ef4444;font-size:16px;margin-top:8px;">ERROR DE CONSULTA</div>
      <div style="font-size:13px;color:var(--muted);margin-top:6px;">${r.error||'Sin conexión'}</div>
      <button onclick="limpiarVerificacion()" class="btn btn-secondary" style="margin-top:14px;width:100%;">REINTENTAR</button>
    </div>`;
    return;
  }

  if (!r.valido) {
    res.innerHTML = `<div style="background:#fee2e2;border-radius:14px;padding:20px;text-align:center;">
      <div style="font-size:40px;">🚫</div>
      <div style="font-weight:800;color:#ef4444;font-size:18px;margin-top:8px;">CÓDIGO NO ENCONTRADO</div>
      <div style="font-size:13px;color:var(--muted);margin-top:6px;font-family:monospace;">${codigo}</div>
      <button onclick="limpiarVerificacion()" class="btn btn-secondary" style="margin-top:14px;width:100%;">ESCANEAR OTRO</button>
    </div>`;
    return;
  }

  if (r.anulado) {
    res.innerHTML = `<div style="background:#fef3c7;border-radius:14px;padding:20px;text-align:center;">
      <div style="font-size:40px;">⚠️</div>
      <div style="font-weight:800;color:#92400e;font-size:16px;margin-top:6px;">CÓDIGO ANULADO</div>
      <div style="font-size:12px;color:#92400e;margin-top:4px;">Este pago fue anulado y no es válido</div>
      <div style="font-family:monospace;background:rgba(0,0,0,0.07);padding:10px;border-radius:8px;margin-top:12px;font-size:13px;">${r.codigo}</div>
      <button onclick="limpiarVerificacion()" class="btn btn-secondary" style="margin-top:14px;width:100%;">ESCANEAR OTRO</button>
    </div>`;
    return;
  }

  res.innerHTML = `
  <div style="background:#d1fae5;border-radius:14px;padding:16px;margin-bottom:10px;text-align:center;">
    <div style="font-size:44px;">✅</div>
    <div style="font-weight:800;color:#065f46;font-size:20px;margin-top:4px;">PAGO VÁLIDO</div>
  </div>
  <div style="background:white;border-radius:14px;padding:16px;box-shadow:var(--shadow);">
    ${vFila('CÓDIGO',         r.codigo,                    true)}
    ${vFila('CLIENTE',        r.cliente)}
    ${vFila('FECHA',          fmtFechaHora(r.fechaPago))}
    ${vFila('PRODUCTO',       r.producto)}
    ${vFila('CUOTA',          r.numeroCuota+'/'+r.totalCuotas)}
    ${vFilaColor('MONTO COBRADO',   fmtGs(r.montoPagado),   'var(--success)', '17px')}
    ${vFilaColor('SALDO RESTANTE',  fmtGs(r.saldoRestante), r.saldoRestante>0?'var(--danger)':'var(--success)', '15px')}
    ${vFila('COBRADOR',       r.cobrador)}
  </div>
  <button onclick="limpiarVerificacion()" class="btn btn-secondary" style="width:100%;margin-top:14px;">🔍 ESCANEAR OTRO</button>`;
}

function vFila(label, valor, mono) {
  const fs = mono ? 'font-family:monospace;font-size:12px;' : 'font-size:13px;';
  return `<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border);">
    <span style="color:var(--muted);font-size:12px;flex-shrink:0;margin-right:8px;">${label}</span>
    <strong style="text-align:right;max-width:65%;word-break:break-all;${fs}">${String(valor||'').toUpperCase()}</strong>
  </div>`;
}
function vFilaColor(label, valor, color, fs) {
  return `<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border);">
    <span style="color:var(--muted);font-size:12px;">${label}</span>
    <strong style="font-size:${fs||'15px'};color:${color};">${valor}</strong>
  </div>`;
}

function limpiarVerificacion() {
  document.getElementById('resultadoVerificacion').innerHTML = '';
  setModoVerificador(_modoVerif); // reinicia el modo actual
}
