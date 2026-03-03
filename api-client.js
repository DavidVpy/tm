// ============================================
// API CLIENT v1.2 - JSONP
// Nuevas funciones: anulacion, reimpresion pagos, clientes atraso
// ============================================

function jsonp(url, params) {
  return new Promise((resolve, reject) => {
    const callbackName = 'jsonp_cb_' + Math.round(100000 * Math.random());
    window[callbackName] = function(data) {
      delete window[callbackName];
      if (script.parentNode) document.body.removeChild(script);
      resolve(data);
    };
    const queryString = Object.keys(params).map(k => encodeURIComponent(k) + '=' + encodeURIComponent(params[k])).join('&');
    const script = document.createElement('script');
    script.src = url + '?' + queryString + '&callback=' + callbackName;
    script.onerror = function() {
      delete window[callbackName];
      if (script.parentNode) document.body.removeChild(script);
      reject(new Error('Error JSONP'));
    };
    setTimeout(() => {
      if (window[callbackName]) {
        delete window[callbackName];
        if (script.parentNode) document.body.removeChild(script);
        reject(new Error('Timeout 30s'));
      }
    }, 30000);
    document.body.appendChild(script);
  });
}

function b64(obj) { return btoa(unescape(encodeURIComponent(JSON.stringify(obj)))); }

async function getUsuariosAPI() {
  try { const r = await jsonp(API_URL, {action:'getUsuarios'}); return r.success ? r.data||[] : []; } catch(e) { return []; }
}
async function validarUsuarioAPI(nombre, pin) {
  try { return await jsonp(API_URL, {action:'validarUsuario', data:b64({nombre,pin})}); } catch(e) { return {success:false,error:e.message}; }
}
async function getClientesAPI() {
  try { const r = await jsonp(API_URL, {action:'getClientes'}); return r.success ? r.data||[] : []; } catch(e) { return []; }
}
async function saveClienteAPI(d) {
  try { return await jsonp(API_URL, {action:'saveCliente', data:b64(d)}); } catch(e) { return {success:false,error:e.message}; }
}
async function updateClienteAPI(d) {
  try { return await jsonp(API_URL, {action:'updateCliente', data:b64(d)}); } catch(e) { return {success:false,error:e.message}; }
}
async function saveVentaAPI(d) {
  try { return await jsonp(API_URL, {action:'saveVenta', data:b64(d)}); } catch(e) { return {success:false,error:e.message}; }
}
async function getVentasAPI() {
  try { const r = await jsonp(API_URL, {action:'getVentas'}); return r.success ? r.data||[] : []; } catch(e) { return []; }
}
async function getVentasClienteAPI(idCliente) {
  try { const r = await jsonp(API_URL, {action:'getVentasCliente', data:b64({idCliente})}); return r.success ? r.data||[] : []; } catch(e) { return []; }
}
async function getDetalleVentaAPI(idVenta) {
  try { const r = await jsonp(API_URL, {action:'getDetalleVenta', data:b64({idVenta})}); return r.success ? r.data||[] : []; } catch(e) { return []; }
}
async function getCuotasVentaAPI(idVenta) {
  try { const r = await jsonp(API_URL, {action:'getCuotasVenta', data:b64({idVenta})}); return r.success ? r.data||[] : []; } catch(e) { return []; }
}
async function getClientesConAtrasoAPI() {
  try { const r = await jsonp(API_URL, {action:'getClientesConAtraso'}); return r.success ? r.data||[] : []; } catch(e) { return []; }
}
async function getCuotasClienteAPI(idCliente) {
  try { const r = await jsonp(API_URL, {action:'getCuotasCliente', data:b64({idCliente})}); return r.success ? r.data||[] : []; } catch(e) { return []; }
}
async function registrarPagoAPI(d) {
  try { return await jsonp(API_URL, {action:'registrarPago', data:b64(d)}); } catch(e) { return {success:false,error:e.message}; }
}
async function getPagosVentaAPI(idVenta) {
  try { const r = await jsonp(API_URL, {action:'getPagosVenta', data:b64({idVenta})}); return r.success ? r.data||[] : []; } catch(e) { return []; }
}
async function anularVentaAPI(d) {
  try { return await jsonp(API_URL, {action:'anularVenta', data:b64(d)}); } catch(e) { return {success:false,error:e.message}; }
}
async function anularPagoAPI(d) {
  try { return await jsonp(API_URL, {action:'anularPago', data:b64(d)}); } catch(e) { return {success:false,error:e.message}; }
}
async function getEstadisticasAPI() {
  try { const r = await jsonp(API_URL, {action:'getEstadisticas'}); return r.success ? r.data : null; } catch(e) { return null; }
}
async function guardarTicketAPI(ticketId, jsonData) {
  try { const r = await jsonp(API_URL, {action:'guardarTicket', data:b64({ticketId,jsonData})}); return r.success; } catch(e) { return false; }
}

async function verificarCodigoAPI(codigo) {
  try { return await jsonp(API_URL, {action:'verificarCodigo', data:b64({codigo})}); } catch(e) { return {success:false,valido:false,error:e.message}; }
}

console.log('🚀 API Client v1.2 cargado');
