// ============================================
// TECH MARKET - Backend v1.6
// Fix: SHEET_ID correcto, USUARIOS 3 cols, CLIENTES 12 cols
//      DETALLE headers completos, PAGOS con ID_Transaccion
// ============================================

const SHEET_ID = '1OcuZ21Ll3sg2rY_Xj0UUuWfQbP0CW5FyI2RlHLYfxxA';

function doGet(e) {
  if (!e || !e.parameter) return HtmlService.createHtmlOutput('<h2>TECH MARKET API v1.6</h2>');
  const action = e.parameter.action;
  const callback = e.parameter.callback || '';
  if (action === 'getTicket') return getTicketJSON(e.parameter.ticketId);
  let data = null;
  if (e.parameter.data) {
    try {
      const dataStr = Utilities.newBlob(Utilities.base64Decode(e.parameter.data)).getDataAsString();
      data = JSON.parse(dataStr);
    } catch (err) { Logger.log('Error decodificar: ' + err); }
  }
  return handleApiRequest_(action, data, callback);
}

function doPost(e) {
  try {
    const action = e.parameter.action;
    const callback = e.parameter.callback || '';
    let data = null;
    if (e.postData && e.postData.contents) {
      try { data = JSON.parse(e.postData.contents); } catch(pe) {}
    }
    return handleApiRequest_(action, data, callback);
  } catch (error) {
    return handleApiRequest_('error', { error: error.toString() }, '');
  }
}

function getTicketJSON(ticketId) {
  try {
    const ss = SpreadsheetApp.openById(SHEET_ID);
    const sheetTickets = ss.getSheetByName('TICKETS_TEMP');
    if (!sheetTickets) return buildErrorTicket('HOJA TICKETS_TEMP NO ENCONTRADA');
    const rows = sheetTickets.getDataRange().getValues();
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][0] === ticketId) {
        const arr = JSON.parse(rows[i][1]);
        const obj = {};
        arr.forEach((item, idx) => { obj[String(idx)] = item; });
        return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
      }
    }
    return buildErrorTicket('TICKET NO ENCONTRADO: ' + ticketId);
  } catch(e) { return buildErrorTicket('ERROR: ' + e.toString()); }
}

function buildErrorTicket(msg) {
  const obj = { "0": { type:0, content:msg, bold:1, align:1 } };
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function guardarTicketTemp(ticketId, jsonData) {
  try {
    const ss = SpreadsheetApp.openById(SHEET_ID);
    let sheet = ss.getSheetByName('TICKETS_TEMP');
    if (!sheet) {
      sheet = ss.insertSheet('TICKETS_TEMP');
      sheet.getRange(1,1,1,3).setValues([['Ticket_ID','JSON_Data','Timestamp']]);
    }
    const rows = sheet.getDataRange().getValues();
    const ahoraMs = new Date().getTime();
    for (let i = rows.length - 1; i >= 1; i--) {
      if (rows[i][2] && (ahoraMs - new Date(rows[i][2]).getTime()) > 3600000) sheet.deleteRow(i + 1);
    }
    sheet.appendRow([ticketId, jsonData, new Date()]);
    return true;
  } catch(e) { Logger.log('Error guardarTicketTemp: ' + e); return false; }
}

function handleApiRequest_(action, data, callback) {
  try {
    let response;
    switch (action) {
      case 'getUsuarios':           response = { success: true, data: getUsuarios() }; break;
      case 'validarUsuario':        response = validarUsuario(data); break;
      case 'getClientes':           response = { success: true, data: getClientes() }; break;
      case 'saveCliente':           response = saveCliente(data); break;
      case 'updateCliente':         response = updateCliente(data); break;
      case 'saveVenta':             response = saveVenta(data); break;
      case 'getVentas':             response = { success: true, data: getVentas() }; break;
      case 'getVentasCliente':      response = { success: true, data: getVentasCliente(data.idCliente) }; break;
      case 'getDetalleVenta':       response = { success: true, data: getDetalleVenta(data.idVenta) }; break;
      case 'getCuotasVenta':        response = { success: true, data: getCuotasVenta(data.idVenta) }; break;
      case 'getClientesConAtraso':  response = { success: true, data: getClientesConAtraso() }; break;
      case 'getCuotasCliente':      response = { success: true, data: getCuotasCliente(data.idCliente) }; break;
      case 'registrarPago':         response = registrarPago(data); break;
      case 'getPagosVenta':         response = { success: true, data: getPagosVenta(data.idVenta) }; break;
      case 'anularVenta':           response = anularVenta(data); break;
      case 'anularPago':            response = anularPago(data); break;
      case 'getEstadisticas':       response = { success: true, data: getEstadisticas() }; break;
      case 'guardarTicket':         response = { success: guardarTicketTemp(data.ticketId, data.jsonData) }; break;
      default: response = { success: false, error: 'Unknown action: ' + action };
    }
    return createJsonResponse_(response, callback);
  } catch (error) {
    Logger.log('Error handleApiRequest: ' + error);
    return createJsonResponse_({ success: false, error: error.toString() }, callback);
  }
}

function createJsonResponse_(data, callback) {
  const json = JSON.stringify(data);
  if (callback) {
    const output = ContentService.createTextOutput(callback + '(' + json + ')');
    output.setMimeType(ContentService.MimeType.JAVASCRIPT);
    return output;
  }
  const output = ContentService.createTextOutput(json);
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}

// ============================================
// USUARIOS - Estructura: [Nombre, PIN, Rol] → col 0, 1, 2
// ============================================
function getUsuarios() {
  try {
    const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName('USUARIOS');
    const data = sheet.getDataRange().getValues();
    const usuarios = [];
    for (let i = 1; i < data.length; i++) {
      if (data[i][0]) usuarios.push({ nombre: String(data[i][0]), rol: String(data[i][2]) });
    }
    return usuarios;
  } catch (e) { Logger.log('Error getUsuarios: ' + e); return []; }
}

function validarUsuario(data) {
  try {
    if (!data || !data.nombre || !data.pin) return { success: false, error: 'DATOS INCOMPLETOS' };
    const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName('USUARIOS');
    const rows = sheet.getDataRange().getValues();
    for (let i = 1; i < rows.length; i++) {
      if (String(rows[i][0]) === String(data.nombre) && String(rows[i][1]) === String(data.pin)) {
        return { success: true, data: { id: i, nombre: String(rows[i][0]), rol: String(rows[i][2]) } };
      }
    }
    return { success: false, error: 'USUARIO O PIN INCORRECTOS' };
  } catch (e) { return { success: false, error: e.toString().toUpperCase() }; }
}

// ============================================
// CLIENTES - Estructura 12 cols:
// [ID_Cliente, CI_RUC, Nombres, Apellidos, Telefono, Email,
//  Direccion, Ciudad, Latitud, Longitud, Alias, Fecha_Registro]
//  col: 0       1       2        3          4      5
//       6         7       8        9         10     11
// ============================================
function getClientes() {
  try {
    const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName('CLIENTES');
    const data = sheet.getDataRange().getValues();
    const clientes = [];
    for (let i = 1; i < data.length; i++) {
      if (data[i][0]) {
        clientes.push({
          ID_Cliente:     data[i][0],
          CI_RUC:         String(data[i][1]).toUpperCase(),
          Nombres:        String(data[i][2]).toUpperCase(),
          Apellidos:      String(data[i][3]).toUpperCase(),
          Telefono:       data[i][4],
          Tel_WhatsApp:   data[i][5],
          Direccion:      String(data[i][6]||'').toUpperCase(),
          Ciudad:         String(data[i][7]||'').toUpperCase(),
          GPS_Lat:        data[i][8],
          GPS_Lng:        data[i][9],
          Alias:          String(data[i][10]||'').toUpperCase(),
          Fecha_Registro: data[i][11],
          Estado:         'ACTIVO'
        });
      }
    }
    return clientes;
  } catch (e) { Logger.log('Error getClientes: ' + e); return []; }
}

function saveCliente(data) {
  try {
    if (!data || !data.ciRuc || !data.nombres || !data.apellidos) return { success: false, error: 'DATOS INCOMPLETOS' };
    const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName('CLIENTES');
    const lastRow = sheet.getLastRow();
    const nuevoId = 'CLI-' + String(lastRow).padStart(3, '0');
    const rows = sheet.getDataRange().getValues();
    for (let i = 1; i < rows.length; i++) {
      if (String(rows[i][1]).toUpperCase() === String(data.ciRuc).toUpperCase()) return { success: false, error: 'CI/RUC YA EXISTE' };
    }
    const telWA = data.telWhatsApp || (data.telefono ? '595' + data.telefono.replace(/-/g, '').substring(1) : '');
    sheet.appendRow([
      nuevoId,
      String(data.ciRuc).toUpperCase(),
      String(data.nombres).toUpperCase(),
      String(data.apellidos).toUpperCase(),
      data.telefono || '',
      telWA,
      String(data.direccion||'').toUpperCase(),
      String(data.ciudad||'').toUpperCase(),
      data.gpsLat || '',
      data.gpsLng || '',
      String(data.alias||'').toUpperCase(),
      new Date()
    ]);
    return { success: true, id: nuevoId };
  } catch (e) { return { success: false, error: e.toString() }; }
}

function updateCliente(data) {
  try {
    if (!data || !data.id) return { success: false, error: 'ID NO PROPORCIONADO' };
    const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName('CLIENTES');
    const rows = sheet.getDataRange().getValues();
    let fila = -1;
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][0] === data.id) { fila = i + 1; break; }
    }
    if (fila === -1) return { success: false, error: 'CLIENTE NO ENCONTRADO' };
    const telWA = data.telWhatsApp || (data.telefono ? '595' + data.telefono.replace(/-/g, '').substring(1) : '');
    sheet.getRange(fila, 5).setValue(data.telefono || '');
    sheet.getRange(fila, 6).setValue(telWA);
    sheet.getRange(fila, 7).setValue(String(data.direccion||'').toUpperCase());
    sheet.getRange(fila, 8).setValue(String(data.ciudad||'').toUpperCase());
    sheet.getRange(fila, 9).setValue(data.gpsLat || '');
    sheet.getRange(fila, 10).setValue(data.gpsLng || '');
    sheet.getRange(fila, 11).setValue(String(data.alias||'').toUpperCase());
    return { success: true };
  } catch (e) { return { success: false, error: e.toString() }; }
}

// ============================================
// VENTAS - 20 cols
// [ID_Venta, Numero_Pedido, Fecha_Venta, ID_Cliente, Cliente_Nombre,
//  Total_Venta, Entrega_Inicial, Saldo_Financiar, Cantidad_Cuotas,
//  Valor_Cuota, Ultima_Cuota, Fecha_Primera_Cuota, Dias_Primera_Cuota,
//  Garantia_Meses, Estado, Saldo_Actual, Anulado, Motivo_Anulacion, Vendedor, Productos]
// ============================================
function saveVenta(data) {
  try {
    const ss = SpreadsheetApp.openById(SHEET_ID);
    const sheetVentas = ss.getSheetByName('VENTAS');
    const sheetDetalle = ss.getSheetByName('DETALLE_PRODUCTOS');
    const sheetCuotas = ss.getSheetByName('CUOTAS');
    const idVenta = 'PED-' + Date.now();
    const totalVenta = Math.ceil(parseFloat(data.totalVenta) || 0);
    const entregaInicial = Math.ceil(parseFloat(data.entregaInicial) || 0);
    const saldoFinanciar = totalVenta - entregaInicial;
    const cantCuotas = parseInt(data.cantidadCuotas) || 0;

    let valorCuotaBase = 0, ultimaCuota = 0;
    if (cantCuotas > 0) {
      const cuotaExacta = saldoFinanciar / cantCuotas;
      valorCuotaBase = Math.ceil(cuotaExacta / 1000) * 1000;
      ultimaCuota = saldoFinanciar - (valorCuotaBase * (cantCuotas - 1));
    }

    const fechaVenta = data.fechaVenta ? new Date(data.fechaVenta) : new Date();
    const diasPrimeraCuota = parseInt(data.diasPrimeraCuota) || 30;
    const fechaPrimeraCuota = new Date(fechaVenta);
    fechaPrimeraCuota.setDate(fechaPrimeraCuota.getDate() + diasPrimeraCuota);
    const productosDesc = data.productos ? data.productos.map(p => String(p.descripcion).toUpperCase()).join(', ') : '';

    sheetVentas.appendRow([
      idVenta, idVenta, fechaVenta, data.idCliente, String(data.nombreCliente).toUpperCase(),
      totalVenta, entregaInicial, saldoFinanciar, cantCuotas,
      valorCuotaBase, ultimaCuota, fechaPrimeraCuota, diasPrimeraCuota,
      parseInt(data.garantiaMeses) || 0, 'ACTIVA', saldoFinanciar,
      false, '', String(data.vendedor).toUpperCase(), productosDesc
    ]);

    if (data.productos && data.productos.length > 0) {
      data.productos.forEach((prod, idx) => {
        const cant = parseInt(prod.cantidad) || 1;
        const precio = Math.ceil(parseFloat(prod.precio) || 0);
        const costo = Math.ceil(parseFloat(prod.costo) || 0);
        const gananciaUnit = precio - costo;
        sheetDetalle.appendRow([
          idVenta + '-' + (idx + 1), idVenta, String(prod.descripcion).toUpperCase(),
          cant, precio, costo, gananciaUnit, gananciaUnit * cant
        ]);
      });
    }

    if (cantCuotas > 0) {
      for (let i = 0; i < cantCuotas; i++) {
        const fechaVenc = new Date(fechaPrimeraCuota);
        fechaVenc.setMonth(fechaVenc.getMonth() + i);
        const montoCuota = (i === cantCuotas - 1) ? ultimaCuota : valorCuotaBase;
        sheetCuotas.appendRow([
          idVenta + '-C' + String(i + 1).padStart(2, '0'),
          idVenta, i + 1, cantCuotas, montoCuota,
          fechaVenc, 0, montoCuota, 'PENDIENTE'
        ]);
      }
    }

    if (entregaInicial > 0) {
      const sheetPagos = ss.getSheetByName('PAGOS');
      const codigoEntrega = 'ENT-' + Math.random().toString(36).substring(2, 10).toUpperCase();
      const idTransaccionEntrega = 'TRX-ENT-' + Date.now().toString(36).toUpperCase();
      sheetPagos.appendRow([
        'PAGO-' + Date.now(), codigoEntrega, fechaVenta,
        data.idCliente, String(data.nombreCliente).toUpperCase(), idVenta,
        data.productos ? String(data.productos[0].descripcion).toUpperCase() : '',
        'ENTREGA', 0, cantCuotas, entregaInicial, saldoFinanciar, fechaPrimeraCuota,
        false, '', String(data.vendedor).toUpperCase(), 'ACTIVO', idTransaccionEntrega
      ]);
    }

    return {
      success: true, numeroPedido: idVenta, idVenta,
      valorCuota: valorCuotaBase, ultimaCuota, saldoFinanciar,
      fechaPrimeraCuota: fechaPrimeraCuota.toISOString(),
      fechaVenta: fechaVenta.toISOString()
    };
  } catch (e) { Logger.log('Error saveVenta: ' + e); return { success: false, error: e.toString() }; }
}

function getVentas() {
  try {
    const ss = SpreadsheetApp.openById(SHEET_ID);
    const ventasData = ss.getSheetByName('VENTAS').getDataRange().getValues();
    const cuotasData = ss.getSheetByName('CUOTAS').getDataRange().getValues();
    const ventas = [];
    for (let i = 1; i < ventasData.length; i++) {
      if (ventasData[i][0] && String(ventasData[i][14]).toUpperCase() !== 'ANULADA') {
        const idVenta = ventasData[i][0];
        let saldoReal = 0;
        for (let k = 1; k < cuotasData.length; k++) {
          if (cuotasData[k][1] === idVenta) {
            const est = String(cuotasData[k][8]).toUpperCase();
            if (est === 'PENDIENTE' || est === 'PARCIAL') saldoReal += parseFloat(cuotasData[k][7]) || 0;
          }
        }
        ventas.push({
          ID_Venta: idVenta, Numero_Pedido: ventasData[i][1],
          Fecha_Venta: ventasData[i][2], ID_Cliente: ventasData[i][3],
          Cliente_Nombre: ventasData[i][4], Total_Venta: Math.ceil(ventasData[i][5]),
          Entrega_Inicial: Math.ceil(ventasData[i][6]), Cantidad_Cuotas: ventasData[i][8],
          Saldo_Actual: Math.ceil(saldoReal), Estado: ventasData[i][14],
          Productos: String(ventasData[i][19]||'')
        });
      }
    }
    return ventas;
  } catch (e) { Logger.log('Error getVentas: ' + e); return []; }
}

function getVentasCliente(idCliente) {
  try {
    const ss = SpreadsheetApp.openById(SHEET_ID);
    const ventasData = ss.getSheetByName('VENTAS').getDataRange().getValues();
    const cuotasData = ss.getSheetByName('CUOTAS').getDataRange().getValues();
    const ventas = [];
    for (let i = 1; i < ventasData.length; i++) {
      if (ventasData[i][3] === idCliente && String(ventasData[i][14]).toUpperCase() !== 'ANULADA') {
        const idVenta = ventasData[i][0];
        let saldoReal = 0;
        for (let k = 1; k < cuotasData.length; k++) {
          if (cuotasData[k][1] === idVenta) {
            const est = String(cuotasData[k][8]).toUpperCase();
            if (est === 'PENDIENTE' || est === 'PARCIAL') saldoReal += parseFloat(cuotasData[k][7]) || 0;
          }
        }
        ventas.push({
          ID_Venta: idVenta, Numero_Pedido: ventasData[i][1],
          Fecha_Venta: ventasData[i][2], Total_Venta: Math.ceil(ventasData[i][5]),
          Entrega_Inicial: Math.ceil(ventasData[i][6]), Saldo_Financiar: Math.ceil(ventasData[i][7]),
          Cantidad_Cuotas: ventasData[i][8], Garantia_Meses: ventasData[i][13],
          Saldo_Actual: Math.ceil(saldoReal), Estado: ventasData[i][14],
          Productos: String(ventasData[i][19]||'')
        });
      }
    }
    return ventas;
  } catch (e) { Logger.log('Error getVentasCliente: ' + e); return []; }
}

function getClientesConAtraso() {
  try {
    const ss = SpreadsheetApp.openById(SHEET_ID);
    const ventasData = ss.getSheetByName('VENTAS').getDataRange().getValues();
    const cuotasData = ss.getSheetByName('CUOTAS').getDataRange().getValues();
    const clientesData = ss.getSheetByName('CLIENTES').getDataRange().getValues();
    const hoy = new Date();
    const ventaMap = {};
    for (let i = 1; i < ventasData.length; i++) {
      if (ventasData[i][0]) ventaMap[ventasData[i][0]] = { idCliente: ventasData[i][3], nombreCliente: ventasData[i][4] };
    }
    const clienteMap = {};
    for (let i = 1; i < clientesData.length; i++) {
      if (clientesData[i][0]) clienteMap[clientesData[i][0]] = { telefono: clientesData[i][4], telWA: clientesData[i][5] };
    }
    const resumen = {};
    for (let i = 1; i < cuotasData.length; i++) {
      const estado = String(cuotasData[i][8]).toUpperCase();
      if ((estado === 'PENDIENTE' || estado === 'PARCIAL') && cuotasData[i][0]) {
        const fechaVenc = new Date(cuotasData[i][5]);
        if (fechaVenc < hoy) {
          const idVenta = cuotasData[i][1];
          const venta = ventaMap[idVenta];
          if (!venta) continue;
          const idCliente = venta.idCliente;
          const diasAtraso = Math.floor((hoy - fechaVenc) / (1000 * 60 * 60 * 24));
          if (!resumen[idCliente]) {
            resumen[idCliente] = {
              ID_Cliente: idCliente, Nombre: venta.nombreCliente,
              Telefono: clienteMap[idCliente] ? clienteMap[idCliente].telefono : '',
              TelWA: clienteMap[idCliente] ? clienteMap[idCliente].telWA : '',
              CuotasVencidas: 0, SaldoTotal: 0, MaxDiasAtraso: 0
            };
          }
          resumen[idCliente].CuotasVencidas++;
          resumen[idCliente].SaldoTotal += Math.ceil(parseFloat(cuotasData[i][7]) || 0);
          if (diasAtraso > resumen[idCliente].MaxDiasAtraso) resumen[idCliente].MaxDiasAtraso = diasAtraso;
        }
      }
    }
    return Object.values(resumen).sort((a, b) => b.MaxDiasAtraso - a.MaxDiasAtraso);
  } catch (e) { Logger.log('Error getClientesConAtraso: ' + e); return []; }
}

function getCuotasCliente(idCliente) {
  try {
    const ss = SpreadsheetApp.openById(SHEET_ID);
    const ventasData = ss.getSheetByName('VENTAS').getDataRange().getValues();
    const cuotasData = ss.getSheetByName('CUOTAS').getDataRange().getValues();
    const ventasCliente = [];
    for (let i = 1; i < ventasData.length; i++) {
      if (ventasData[i][3] === idCliente && String(ventasData[i][14]).toUpperCase() !== 'ANULADA') ventasCliente.push(ventasData[i][0]);
    }
    const cuotas = [];
    for (let i = 1; i < cuotasData.length; i++) {
      if (ventasCliente.includes(cuotasData[i][1]) && cuotasData[i][0]) {
        cuotas.push({
          ID_Cuota: cuotasData[i][0], ID_Venta: cuotasData[i][1],
          Numero_Cuota: cuotasData[i][2], Total_Cuotas: cuotasData[i][3],
          Monto_Cuota: Math.ceil(cuotasData[i][4]), Fecha_Vencimiento: cuotasData[i][5],
          Monto_Pagado: Math.ceil(cuotasData[i][6]), Saldo_Cuota: Math.ceil(cuotasData[i][7]),
          Estado: String(cuotasData[i][8]).toUpperCase()
        });
      }
    }
    return cuotas;
  } catch (e) { Logger.log('Error getCuotasCliente: ' + e); return []; }
}

// ============================================
// PAGOS - 18 cols con ID_Transaccion en col 18 (idx 17)
// ============================================
function registrarPago(data) {
  try {
    const ss = SpreadsheetApp.openById(SHEET_ID);
    const sheetPagos = ss.getSheetByName('PAGOS');
    const sheetCuotas = ss.getSheetByName('CUOTAS');
    const sheetVentas = ss.getSheetByName('VENTAS');
    const ts = Date.now().toString(36).toUpperCase();
    const rnd = Math.random().toString(36).substring(2, 7).toUpperCase();
    const codigoVerif = 'PAG-' + ts + '-' + rnd;
    const idPago = 'PAGO-' + Date.now();
    const idTransaccion = 'TRX-' + ts + '-' + rnd;

    const cuotasData = sheetCuotas.getDataRange().getValues();
    let filaCuota = -1, cuotaActual = null;
    for (let i = 1; i < cuotasData.length; i++) {
      if (cuotasData[i][0] === data.idCuota) { filaCuota = i + 1; cuotaActual = cuotasData[i]; break; }
    }
    if (filaCuota === -1) return { success: false, error: 'CUOTA NO ENCONTRADA' };

    const montoPagado = Math.ceil(parseFloat(data.montoPago));
    const saldoActual = Math.ceil(parseFloat(cuotaActual[7]));
    const nuevoSaldo = Math.max(0, saldoActual - montoPagado);
    let nuevoEstado = 'PENDIENTE';
    if (nuevoSaldo <= 0) nuevoEstado = 'PAGADA';
    else if (montoPagado > 0) nuevoEstado = 'PARCIAL';

    sheetCuotas.getRange(filaCuota, 7).setValue(Math.ceil(parseFloat(cuotaActual[6]) + montoPagado));
    sheetCuotas.getRange(filaCuota, 8).setValue(nuevoSaldo);
    sheetCuotas.getRange(filaCuota, 9).setValue(nuevoEstado);

    const idVenta = data.idVenta;
    const cuotasAct = sheetCuotas.getDataRange().getValues();
    let saldoVenta = 0;
    for (let i = 1; i < cuotasAct.length; i++) {
      if (cuotasAct[i][1] === idVenta) {
        const est = String(cuotasAct[i][8]).toUpperCase();
        if (est === 'PENDIENTE' || est === 'PARCIAL') saldoVenta += Math.ceil(parseFloat(cuotasAct[i][7]) || 0);
      }
    }

    const ventasData = sheetVentas.getDataRange().getValues();
    for (let i = 1; i < ventasData.length; i++) {
      if (ventasData[i][0] === idVenta) {
        sheetVentas.getRange(i + 1, 16).setValue(saldoVenta);
        if (saldoVenta <= 0) sheetVentas.getRange(i + 1, 15).setValue('COMPLETADA');
        break;
      }
    }

    const proximas = cuotasAct.slice(1)
      .filter(c => c[1] === idVenta && (String(c[8]).toUpperCase() === 'PENDIENTE' || String(c[8]).toUpperCase() === 'PARCIAL'))
      .sort((a, b) => new Date(a[5]) - new Date(b[5]));
    const proximaFecha = proximas.length > 0 ? proximas[0][5] : '';

    let productoDesc = '';
    for (let i = 1; i < ventasData.length; i++) {
      if (ventasData[i][0] === idVenta) { productoDesc = String(ventasData[i][19]||''); break; }
    }

    const fechaPago = data.fechaPago ? new Date(data.fechaPago) : new Date();

    sheetPagos.appendRow([
      idPago, codigoVerif, fechaPago,
      data.idCliente, String(data.nombreCliente).toUpperCase(), idVenta, productoDesc,
      data.idCuota, cuotaActual[2], cuotaActual[3],
      montoPagado, saldoVenta, proximaFecha,
      false, '', String(data.cobrador).toUpperCase(), 'ACTIVO', idTransaccion
    ]);

    return {
      success: true, codigoVerificacion: codigoVerif, idPago, idTransaccion,
      saldoRestante: saldoVenta, proximaFecha, productoDesc,
      numeroCuota: cuotaActual[2], totalCuotas: cuotaActual[3],
      montoCuota: Math.ceil(cuotaActual[4]), nombreCliente: data.nombreCliente,
      fechaPago: fechaPago.toISOString()
    };
  } catch (e) { Logger.log('Error registrarPago: ' + e); return { success: false, error: e.toString() }; }
}

function getPagosVenta(idVenta) {
  try {
    const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName('PAGOS');
    const data = sheet.getDataRange().getValues();
    const pagos = [];
    for (let i = 1; i < data.length; i++) {
      if (data[i][5] === idVenta && String(data[i][16]).toUpperCase() !== 'ANULADO') {
        pagos.push({
          ID_Pago: data[i][0], Codigo_Verificacion: data[i][1],
          Fecha_Pago: data[i][2], ID_Cliente: data[i][3], Nombre_Cliente: data[i][4],
          ID_Venta: data[i][5], Producto: data[i][6], ID_Cuota: data[i][7],
          Numero_Cuota: data[i][8], Total_Cuotas: data[i][9],
          Monto_Pagado: Math.ceil(data[i][10]), Saldo_Restante: Math.ceil(data[i][11]),
          Proxima_Fecha: data[i][12], Cobrador: data[i][15],
          Estado: data[i][16], ID_Transaccion: data[i][17]
        });
      }
    }
    return pagos;
  } catch(e) { Logger.log('Error getPagosVenta: ' + e); return []; }
}

function anularVenta(data) {
  try {
    if (!data || !data.idVenta || !data.motivo) return { success: false, error: 'DATOS INCOMPLETOS' };
    const ss = SpreadsheetApp.openById(SHEET_ID);
    const sheetVentas = ss.getSheetByName('VENTAS');
    const sheetCuotas = ss.getSheetByName('CUOTAS');
    const sheetAnulaciones = ss.getSheetByName('ANULACIONES');
    const ventasData = sheetVentas.getDataRange().getValues();
    let filaVenta = -1;
    for (let i = 1; i < ventasData.length; i++) {
      if (ventasData[i][0] === data.idVenta) { filaVenta = i + 1; break; }
    }
    if (filaVenta === -1) return { success: false, error: 'VENTA NO ENCONTRADA' };
    sheetVentas.getRange(filaVenta, 15).setValue('ANULADA');
    const cuotasData = sheetCuotas.getDataRange().getValues();
    for (let i = 1; i < cuotasData.length; i++) {
      if (cuotasData[i][1] === data.idVenta) {
        const est = String(cuotasData[i][8]).toUpperCase();
        if (est === 'PENDIENTE' || est === 'PARCIAL') sheetCuotas.getRange(i + 1, 9).setValue('ANULADA');
      }
    }
    const codigoAnul = 'ANUL-' + Date.now().toString(36).toUpperCase();
    if (sheetAnulaciones) {
      sheetAnulaciones.appendRow([
        codigoAnul, new Date(), 'VENTA', data.idVenta,
        String(data.motivo).toUpperCase(), String(data.usuario||'').toUpperCase(),
        '', String(data.observacion||'').toUpperCase()
      ]);
    }
    return { success: true, codigoAnulacion: codigoAnul };
  } catch(e) { Logger.log('Error anularVenta: ' + e); return { success: false, error: e.toString() }; }
}

function anularPago(data) {
  try {
    if (!data || !data.idPago || !data.motivo) return { success: false, error: 'DATOS INCOMPLETOS' };
    const ss = SpreadsheetApp.openById(SHEET_ID);
    const sheetPagos = ss.getSheetByName('PAGOS');
    const sheetCuotas = ss.getSheetByName('CUOTAS');
    const sheetAnulaciones = ss.getSheetByName('ANULACIONES');
    const pagosData = sheetPagos.getDataRange().getValues();
    let filaPago = -1, pagoActual = null;
    for (let i = 1; i < pagosData.length; i++) {
      if (pagosData[i][0] === data.idPago) { filaPago = i + 1; pagoActual = pagosData[i]; break; }
    }
    if (filaPago === -1) return { success: false, error: 'PAGO NO ENCONTRADO' };
    sheetPagos.getRange(filaPago, 17).setValue('ANULADO');
    if (pagoActual[7] !== 'ENTREGA') {
      const cuotasData = sheetCuotas.getDataRange().getValues();
      for (let i = 1; i < cuotasData.length; i++) {
        if (cuotasData[i][0] === pagoActual[7]) {
          const montoPagAnt = Math.ceil(parseFloat(cuotasData[i][6]) - parseFloat(pagoActual[10]));
          const nuevoSaldo = Math.ceil(parseFloat(cuotasData[i][4]));
          sheetCuotas.getRange(i + 1, 7).setValue(Math.max(0, montoPagAnt));
          sheetCuotas.getRange(i + 1, 8).setValue(nuevoSaldo);
          sheetCuotas.getRange(i + 1, 9).setValue('PENDIENTE');
          break;
        }
      }
    }
    const codigoAnul = 'ANUL-' + Date.now().toString(36).toUpperCase();
    if (sheetAnulaciones) {
      sheetAnulaciones.appendRow([
        codigoAnul, new Date(), 'PAGO', data.idPago,
        String(data.motivo).toUpperCase(), String(data.usuario||'').toUpperCase(),
        pagoActual[1], String(data.observacion||'').toUpperCase()
      ]);
    }
    return { success: true, codigoAnulacion: codigoAnul };
  } catch(e) { Logger.log('Error anularPago: ' + e); return { success: false, error: e.toString() }; }
}

function getDetalleVenta(idVenta) {
  try {
    const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName('DETALLE_PRODUCTOS');
    const data = sheet.getDataRange().getValues();
    const items = [];
    for (let i = 1; i < data.length; i++) {
      if (data[i][1] === idVenta) {
        items.push({
          Descripcion: data[i][2], Cantidad: data[i][3],
          Precio_Unitario: Math.ceil(data[i][4]),
          Costo: Math.ceil(data[i][5] || 0),
          Ganancia_Unit: Math.ceil(data[i][6] || 0),
          Subtotal: Math.ceil(data[i][4] * data[i][3])
        });
      }
    }
    return items;
  } catch(e) { Logger.log('Error getDetalleVenta: ' + e); return []; }
}

function getCuotasVenta(idVenta) {
  try {
    const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName('CUOTAS');
    const data = sheet.getDataRange().getValues();
    const cuotas = [];
    for (let i = 1; i < data.length; i++) {
      if (data[i][1] === idVenta && data[i][0]) {
        cuotas.push({
          ID_Cuota: data[i][0], Numero_Cuota: data[i][2], Total_Cuotas: data[i][3],
          Monto_Cuota: Math.ceil(data[i][4]), Fecha_Vencimiento: data[i][5],
          Monto_Pagado: Math.ceil(data[i][6]), Saldo_Cuota: Math.ceil(data[i][7]),
          Estado: String(data[i][8]).toUpperCase()
        });
      }
    }
    return cuotas;
  } catch(e) { Logger.log('Error getCuotasVenta: ' + e); return []; }
}

// ============================================
// ESTADÍSTICAS
// ============================================
function getEstadisticas() {
  try {
    const hoy = new Date();
    const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    const ss = SpreadsheetApp.openById(SHEET_ID);
    const ventasData = ss.getSheetByName('VENTAS').getDataRange().getValues();
    const pagosData = ss.getSheetByName('PAGOS').getDataRange().getValues();
    const cuotasData = ss.getSheetByName('CUOTAS').getDataRange().getValues();
    let ventasHoy=0, ventasMes=0, cobrosHoy=0, cobrosMes=0, cuotasVencidas=0;
    let totalVentasMes=0, creditosActivos=0, totalCreditosActivos=0;

    for (let i = 1; i < ventasData.length; i++) {
      if (String(ventasData[i][14]).toUpperCase() === 'ANULADA') continue;
      const fecha = new Date(ventasData[i][2]);
      if (fecha.toDateString() === hoy.toDateString()) ventasHoy++;
      if (fecha >= inicioMes) { ventasMes++; totalVentasMes += Math.ceil(parseFloat(ventasData[i][5]) || 0); }
      const saldo = Math.ceil(parseFloat(ventasData[i][15]) || 0);
      if (saldo > 0) { creditosActivos++; totalCreditosActivos += saldo; }
    }

    for (let i = 1; i < pagosData.length; i++) {
      if (String(pagosData[i][16]).toUpperCase() === 'ANULADO') continue;
      const fecha = new Date(pagosData[i][2]);
      if (fecha.toDateString() === hoy.toDateString()) cobrosHoy++;
      if (fecha >= inicioMes) cobrosMes++;
    }

    for (let i = 1; i < cuotasData.length; i++) {
      const est = String(cuotasData[i][8]).toUpperCase();
      if ((est === 'PENDIENTE' || est === 'PARCIAL') && cuotasData[i][0]) {
        if (new Date(cuotasData[i][5]) < hoy) cuotasVencidas++;
      }
    }

    return { ventasHoy, ventasMes, cobrosHoy, cobrosMes, cuotasVencidas, totalVentasMes, creditosActivos, totalCreditosActivos };
  } catch(e) {
    return { ventasHoy:0, ventasMes:0, cobrosHoy:0, cobrosMes:0, cuotasVencidas:0, totalVentasMes:0, creditosActivos:0, totalCreditosActivos:0 };
  }
}
