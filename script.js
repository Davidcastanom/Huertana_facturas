/**
 * ==========================================
 * CATÁLOGO DE PRODUCTOS (BASE DE DATOS)
 * ==========================================
 * ¡Aquí puedes añadir hasta 500 o más productos!
 * Están estructurados por 'categorías' para que el listado visual sea más ordenado en pantalla.
 *  - category: El nombre del bloque o familia
 *  - items: La lista interna
 *      > id: número único (No lo repitas nunca)
 *      > name: Cómo se llama el producto
 *      > unit: Cómo lo cobras: kg, gr, unidad, paquete, lb...
 *      > baseCost: Costo interno base de compra (sin margen)
 */
const CATALOG_DB = [
    {
        category: "🥬 Verduras y Hortalizas",
        items: [
            { id: 1, name: "Tomate Chonto", unit: "kg", baseCost: 3000 },
            { id: 2, name: "Cebolla Cabezona", unit: "kg", baseCost: 2500 },
            { id: 3, name: "Zanahoria", unit: "kg", baseCost: 1500 },
            { id: 10, name: "Ajo", unit: "unidad", baseCost: 500 },
            { id: 11, name: "Cilantro", unit: "paquete", baseCost: 1000 },
            { id: 12, name: "Pimentón", unit: "kg", baseCost: 4500 },
            { id: 18, name: "Lechuga Batavia", unit: "unidad", baseCost: 2500 },
            { id: 19, name: "Brócoli", unit: "unidad", baseCost: 3000 },
            { id: 20, name: "Apio", unit: "unidad", baseCost: 2000 }
        ]
    },
    {
        category: "🍎 Frutas y Cítricos",
        items: [
            { id: 4, name: "Aguacate Hass", unit: "kg", baseCost: 6000 },
            { id: 5, name: "Limón Tahití", unit: "kg", baseCost: 4000 },
            { id: 6, name: "Mango Tommy", unit: "kg", baseCost: 3500 },
            { id: 8, name: "Naranja Valencia", unit: "kg", baseCost: 2000 },
            { id: 13, name: "Manzana Roja", unit: "unidad", baseCost: 1500 },
            { id: 14, name: "Banano", unit: "kg", baseCost: 2000 },
            { id: 15, name: "Lulo", unit: "kg", baseCost: 5000 },
            { id: 16, name: "Fresa", unit: "kg", baseCost: 8000 },
            { id: 17, name: "Mora", unit: "kg", baseCost: 6000 }
        ]
    },
    {
        category: "🥔 Tubérculos y Plátanos",
        items: [
            { id: 7, name: "Plátano Maduro", unit: "kg", baseCost: 2800 },
            { id: 9, name: "Papa Pastusa", unit: "kg", baseCost: 2200 }
        ]
    },
    {
        category: "📦 Procesados y Otros",
        items: [
            // Puedes ir agregando más bloques id 100 en adelante
            // { id: 100, name: "Pulpa de Mango", unit: "unidad", baseCost: 2500 }
        ]
    }
];

// (Filtro interno invisible): Pone todo plano para el buscador inteligente ultrarrápido
const PRODUCTS_DB = CATALOG_DB.flatMap(cat => cat.items);

// APLICAR PERSISTENCIA: Sustituye el precio original por el precio acordado en el Historial si existiese
const savedCosts = JSON.parse(localStorage.getItem('MODIFIED_BASE_COSTS')) || {};
Object.keys(savedCosts).forEach(id => {
    let p = PRODUCTS_DB.find(prod => prod.id == Number(id));
    if (p) p.baseCost = savedCosts[id];
});

// Arreglo para almacenar los items interpretados
let currentParsedItems = [];


/**
 * ==========================================
 * LÓGICA DE NEGOCIO Y PARSER
 * ==========================================
 */

// Normaliza strings (quita tildes, minúsculas, espacios extra)
function normalizeString(str) {
    if (!str) return "";
    return str.toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Remueve tildes
        .replace(/[^a-z0-9\s]/g, "") // Remueve símbolos raros
        .trim();
}

// Algoritmo de Distancia de Levenshtein (Fuzzy Matching)
function levenshteinDistance(a, b) {
    const matrix = [];
    for (let i = 0; i <= b.length; i++) {
        matrix[i] = [i];
    }
    for (let j = 0; j <= a.length; j++) {
        matrix[0][j] = j;
    }
    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) == a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1, // Sustitución
                    Math.min(matrix[i][j - 1] + 1, // Inserción
                        matrix[i - 1][j] + 1) // Borrado
                );
            }
        }
    }
    return matrix[b.length][a.length];
}

// Busca el producto más parecido en la DB
function findBestProductMatch(rawName) {
    const normInput = normalizeString(rawName);
    let bestMatch = null;
    let minDistance = Infinity;

    // Primero intenta buscar si contiene una palabra clave exacta
    for (const prod of PRODUCTS_DB) {
        const normProd = normalizeString(prod.name);
        if (normInput.includes(normProd) || normProd.includes(normInput)) {
            return prod;
        }
    }

    // Si no, usa fuzzy matching
    for (const prod of PRODUCTS_DB) {
        const normProd = normalizeString(prod.name);
        const dist = levenshteinDistance(normInput, normProd);
        if (dist < minDistance) {
            minDistance = dist;
            bestMatch = prod;
        }
    }

    // Umbral de tolerancia de error (si hay más de 4 errores tipográficos asumimos que no es el producto)
    return minDistance <= 4 ? bestMatch : null;
}

// Identifica cantidad, unidad y nombre del producto en una línea
function parseLine(line) {
    let originalLine = line.trim();
    if (!originalLine) return null;

    let qty = 1;
    let unit = "unidad";
    let name = originalLine;

    // Regex para casos ej: "2kg aguacate" o "1.5 kg papas" o "500 gr tomate"
    const regexNumberFirst = /^([\d\.,]+)\s*(kg|kilo|kilos|k|gr|gramos|g|lb|libras|libra|unidad|unidades|ud|uds)?\s*(?:de\s+)?(.*)$/i;
    // Regex para casos ej: "aguacate 2kg" o "papas 2.5 kilos"
    const regexTextFirst = /^(.*(?:[a-zñáéíóú]))\s*(?:de\s+)?([\d\.,]+)\s*(kg|kilo|kilos|k|gr|gramos|g|lb|libras|libra|unidad|unidades|ud|uds)?$/i;

    let matchParts = { qtyFound: false };

    let match1 = originalLine.match(regexNumberFirst);
    let match2 = originalLine.match(regexTextFirst);

    if (match1) {
        qty = parseFloat(match1[1].replace(',', '.'));
        unit = match1[2] || 'unidad';
        name = match1[3];
        matchParts.qtyFound = true;
    } else if (match2) {
        name = match2[1];
        qty = parseFloat(match2[2].replace(',', '.'));
        unit = match2[3] || 'unidad';
        matchParts.qtyFound = true;
    }

    // Normalizar nombres de unidades de uso común
    unit = normalizeString(unit);
    if (["kg", "kilo", "kilos", "k"].includes(unit)) unit = "kg";
    else if (["gr", "gramos", "g"].includes(unit)) unit = "gr";
    else if (["lb", "libra", "libras"].includes(unit)) unit = "lb";
    else unit = "unidad";

    const productMatch = findBestProductMatch(name);

    return {
        originalLine,
        product: productMatch, // Puede ser null si no encontró
        qty: qty || 1,
        unit: unit,
        unknownName: productMatch ? "" : name // Si no lo encontró, guarda el nombre texto
    };
}


/**
 * ==========================================
 * INTERFAZ Y MANEJO DEL DOM
 * ==========================================
 */

// Inicializa valores por defecto de la interfaz
document.addEventListener("DOMContentLoaded", () => {
    // 1. Crear el Datalist Global (Buscador/Autocompletado nativo del navegador superando el límite de <select>)
    const datalist = document.createElement('datalist');
    datalist.id = "global-products-list";
    PRODUCTS_DB.forEach(p => {
        const option = document.createElement('option');
        option.value = p.name;
        datalist.appendChild(option);
    });
    document.body.appendChild(datalist);

    // 2. Añadimos costos iniciales de ejemplo preventivos
    addCostRow('variable-costs-container', 'Bolsas Biodegradables', 500);
    addCostRow('fixed-costs-container', 'Domicilio', 5000);
});

// Agrega una fila de costos dinámicos
function addCostRow(containerId, name = '', value = 0) {
    const container = document.getElementById(containerId);
    const row = document.createElement('div');
    row.className = 'cost-row';

    row.innerHTML = `
        <input type="text" placeholder="Nombre" value="${name}">
        <input type="number" placeholder="Valor ($)" value="${value}" min="0">
        <label style="display:flex; align-items:center; font-size:0.8rem; margin:0 5px; cursor:pointer;" title="Aplicar IVA"><input type="checkbox" class="cost-iva-chk" style="width:auto; margin-right:5px; transform:scale(1.2);"> IVA</label>
        <button class="btn-remove" onclick="this.parentElement.remove()">X</button>
    `;
    container.appendChild(row);
}

// Map verbal numbers to digits to aid speech-to-text
function normalizeVoiceText(rawText) {
    let txt = rawText.toLowerCase();
    const numMap = {
        "un": 1, "una": 1, "uno": 1, "dos": 2, "tres": 3, "cuatro": 4, "cinco": 5,
        "seis": 6, "siete": 7, "ocho": 8, "nueve": 9, "diez": 10,
        "once": 11, "doce": 12, "quince": 15, "veinte": 20, "treinta": 30,
        "medio kilo de": "0.5 kg de", "media libra de": "0.5 lb de",
        "medio": 0.5, "media": 0.5, "cuarto": 0.25
    };
    Object.keys(numMap).forEach(word => {
        txt = txt.replace(new RegExp(`\\b${word}\\b`, 'gi'), numMap[word]);
    });
    // Split continuous speech into logical lines
    txt = txt.replace(/,\s*/g, '\n');
    txt = txt.replace(/\.\s*/g, '\n');
    txt = txt.replace(/\s+y\s+/gi, '\n');
    txt = txt.replace(/\s+además\s+/gi, '\n');
    txt = txt.replace(/\s+tambien\s+/gi, '\n');
    txt = txt.replace(/\s+tambi[eé]n\s+/gi, '\n');
    return txt;
}

// Procesa el textarea origen y genera la tabla de revisión
function processOrder() {
    let rawText = document.getElementById('whatsapp-input').value;
    const text = normalizeVoiceText(rawText);
    const lines = text.split('\n');
    currentParsedItems = [];

    const reviewTbody = document.getElementById('review-tbody');
    reviewTbody.innerHTML = '';

    const marginValue = parseFloat(document.getElementById('profit-margin').value) || 0;
    let hasAlerts = false;

    lines.forEach((line, index) => {
        if (!line.trim()) return;

        const parsed = parseLine(line);
        if (!parsed) return;

        parsed.id = index; // Id virtual para la fila
        currentParsedItems.push(parsed);

        const tr = document.createElement('tr');

        let warningLabel = "";
        if (!parsed.product) {
            warningLabel = `<div style="color: #d32f2f; font-weight: bold; font-size: 0.8rem; margin-top: 4px;">⚠️ Producto no reconocido</div>`;
            tr.style.backgroundColor = '#ffebee';
            hasAlerts = true;
        } else if (parsed.unit !== parsed.product.unit && !(parsed.unit === 'gr' && parsed.product.unit === 'kg')) {
            warningLabel = `<div style="color: #e65100; font-weight: bold; font-size: 0.8rem; margin-top: 4px;">⚠️ Ojo: Pedido en '${parsed.unit}' pero el precio es en '${parsed.product.unit}'</div>`;
            tr.style.backgroundColor = '#fff3cd';
            hasAlerts = true;
        }

        // Selector de medidas
        const unitOptions = ['kg', 'gr', 'unidad', 'paquete'].map(u =>
            `<option value="${u}" ${parsed.unit === u ? 'selected' : ''}>${u}</option>`
        ).join('');

        // Pre-calcular precio unitario de venta (Base + Margen)
        let calcPrice = 0;
        if (parsed.product) {
            calcPrice = parsed.product.baseCost * (1 + (marginValue / 100));
        }

        const customNameVal = parsed.unknownName || parsed.originalLine || "";
        const initName = parsed.product ? parsed.product.name : customNameVal;

        const pvName = parsed.product ? (ACTIVE_PROVIDERS[parsed.product.id] || "Catálogo General") : "Desconocido";

        tr.innerHTML = `
            <td><small>${parsed.originalLine}</small>${warningLabel}</td>
            <td>
                <input type="text" id="prod-${index}" list="global-products-list" value="${initName}" style="width: 100%; padding: 5px;" placeholder="Escribe para buscar o añade..." onchange="onProductSelectChange(${index}); updateRow(${index})">
                <span id="prov-badge-${index}"><div style="color: #0288D1; font-size: 0.75rem; margin-top: 4px;">🏢 <b>${pvName}</b></div></span>
            </td>
            <td><input type="number" id="qty-${index}" value="${parsed.qty}" step="0.1" min="0.1" style="width: 70px" onchange="updateRow(${index})"></td>
            <td><select id="unit-${index}" onchange="updateRow(${index})">${unitOptions}</select></td>
            <td>$<input type="number" id="price-${index}" value="${Math.round(calcPrice)}" style="width: 90px" onchange="updateRow(${index})"></td>
            <td id="sub-${index}">$${Math.round(calcPrice * parsed.qty * (parsed.unit === 'gr' ? 0.001 : 1))}</td>
            <td style="text-align:center;"><input type="checkbox" id="iva-${index}" style="transform:scale(1.2); cursor:pointer;"></td>
            <td><button class="btn-remove" onclick="removeRow(${index}, this)">🗑️</button></td>
        `;

        reviewTbody.appendChild(tr);
    });

    document.getElementById('review-section').style.display = 'block';
    document.getElementById('invoice-section').style.display = 'none'; // Ocultar factura antigua

    if (hasAlerts) {
        setTimeout(() => {
            alert("¡Atención! Hay ítems que no fueron reconocidos o donde la unidad solicitada (ej. unidades) difiere de la forma de venta (ej. kilogramos). Por favor revisa las filas resaltadas en color.");
        }, 100);
    }
}

function onProductSelectChange(index) {
    const marginValue = parseFloat(document.getElementById('profit-margin').value) || 0;
    const inputVal = document.getElementById(`prod-${index}`).value;

    // Buscar si el texto tipeado coincide con un producto catalogado
    const prod = PRODUCTS_DB.find(p => p.name.toLowerCase() === inputVal.toLowerCase());

    if (prod) {
        // Autocompleta automáticamente precios y unidad
        const newPrice = Math.round(prod.baseCost * (1 + (marginValue / 100)));
        document.getElementById(`price-${index}`).value = newPrice;

        const unitSelect = document.getElementById(`unit-${index}`);
        if (unitSelect) {
            unitSelect.value = prod.unit;
        }

        const badgeHtml = document.getElementById(`prov-badge-${index}`);
        if (badgeHtml) {
            const pvrName = ACTIVE_PROVIDERS[prod.id] || "Catálogo General";
            badgeHtml.innerHTML = `<div style="color: #0288D1; font-size: 0.75rem; margin-top: 4px;">🏢 <b>${pvrName}</b></div>`;
        }
    }
}

// Actualiza en tiempo real el subtotal de una fila editable
function updateRow(index) {
    const marginValue = parseFloat(document.getElementById('profit-margin').value) || 0;

    const qty = parseFloat(document.getElementById(`qty-${index}`).value) || 0;
    const price = parseFloat(document.getElementById(`price-${index}`).value) || 0;
    const unit = document.getElementById(`unit-${index}`).value;

    let multiplier = 1;
    if (unit === 'gr') multiplier = 0.001;

    // Actualiza DOM
    document.getElementById(`sub-${index}`).innerText = `$${Math.round(qty * multiplier * price)}`;
}

function removeRow(index, btnElement) {
    btnElement.closest('tr').remove();
    // Lo eliminamos de currentParsedItems por índice
    const itemIdx = currentParsedItems.findIndex(i => i.id === index);
    if (itemIdx !== -1) {
        currentParsedItems.splice(itemIdx, 1);
    }
}

// Recolectar costos de los contenedores
function collectCosts(containerId) {
    const costs = [];
    const container = document.getElementById(containerId);
    const rows = container.querySelectorAll('.cost-row');
    rows.forEach(row => {
        const inputs = row.querySelectorAll('input');
        const name = inputs[0].value.trim();
        const value = parseFloat(inputs[1].value) || 0;
        const applyIva = inputs[2] ? inputs[2].checked : false;
        if (name && value > 0) {
            costs.push({ name, value, applyIva });
        }
    });
    return costs;
}


// Genera y formatea el texto final para WhatsApp
function generateInvoice() {
    if (currentParsedItems.length === 0) {
        alert("No hay items para facturar.");
        return;
    }

    const taxRate = parseFloat(document.getElementById('tax-margin').value) || 19;
    let invoiceText = "🛒 *RESUMEN DE TU PEDIDO* 🛒\n\n";

    // Variables Base para PDF
    const cName = document.getElementById('company-name').value || "Mi Frutería";
    const cNit = document.getElementById('company-nit').value || "";
    const cPhone = document.getElementById('company-phone').value || "";
    const pDate = new Date().toLocaleDateString();
    let htmlPrintRows = "";

    let itemsTotal = 0;
    let ivaDetails = []; // Para almacenar items con IVA
    let totalIvaSum = 0;

    // Barrer las filas que sobrevivieron en el DOM
    currentParsedItems.forEach(item => {
        const prodInput = document.getElementById(`prod-${item.id}`);
        // Puede que el array tenga el item pero el dom fue eliminado si el usuario borró la fila violentamente, validamos:
        if (!prodInput) return;

        const qty = parseFloat(document.getElementById(`qty-${item.id}`).value) || 0;
        const unit = document.getElementById(`unit-${item.id}`).value;
        const price = parseFloat(document.getElementById(`price-${item.id}`).value) || 0;
        const applyIva = document.getElementById(`iva-${item.id}`).checked;

        let productName = prodInput.value.trim();
        if (productName === "") productName = "Item Manual";

        let multiplier = 1;
        let baseUnit = unit;

        if (item.product && item.product.unit) {
            baseUnit = item.product.unit;
        } else if (unit === 'gr') {
            baseUnit = 'kg'; // Si piden gramos (0.001) el precio cobrado en UI asume Kilos.
        }

        if (unit === 'gr') multiplier = 0.001;

        const subtotal = Math.round(qty * multiplier * price);
        itemsTotal += subtotal;

        let ivaStr = "";
        let rowIvaVal = 0;
        if (applyIva) {
            const ivaValue = Math.round(subtotal * (taxRate / 100));
            rowIvaVal = ivaValue;
            totalIvaSum += ivaValue;
            ivaDetails.push(`- IVA ${productName}: $${ivaValue.toLocaleString('es-CO')}`);
            ivaStr = ` *(+IVA)*`;
        }

        let priceDesc = `$${price.toLocaleString('es-CO')}/${baseUnit}`;

        invoiceText += `✅ ${productName} (${qty} ${unit}) a ${priceDesc}${ivaStr}\n   $${subtotal.toLocaleString('es-CO')}\n`;
        htmlPrintRows += `<tr>
            <td>${qty} ${unit}</td>
            <td>${productName}</td>
            <td>${priceDesc}</td>
            <td>$${rowIvaVal.toLocaleString('es-CO')}</td>
            <td>$${subtotal.toLocaleString('es-CO')}</td>
        </tr>`;
    });

    invoiceText += `\n📦 *Subtotal Productos:* $${itemsTotal.toLocaleString('es-CO')}\n`;

    let finalTotal = itemsTotal;

    // Sumar costos dinámicos y evaluar separador formal
    const varCosts = collectCosts('variable-costs-container');
    const fixedCosts = collectCosts('fixed-costs-container');

    if (varCosts.length > 0 || fixedCosts.length > 0) {
        htmlPrintRows += `<tr style="background-color: #eceff1; font-weight: bold; font-size: 13px;">
            <td colspan="5" style="text-align: center; border-top: 2px solid #555;">⬇ COSTOS EXTRAS Y SERVICIOS ⬇</td>
        </tr>`;
    }

    if (varCosts.length > 0) {
        invoiceText += `\n*Adicionales:*\n`;
        varCosts.forEach(vc => {
            let ivaStr = "";
            let rowIvaVal = 0;
            if (vc.applyIva) {
                const ivaValue = Math.round(vc.value * (taxRate / 100));
                rowIvaVal = ivaValue;
                totalIvaSum += ivaValue;
                ivaDetails.push(`- IVA ${vc.name}: $${ivaValue.toLocaleString('es-CO')}`);
                ivaStr = ` *(+IVA)*`;
            }
            invoiceText += `➕ ${vc.name}${ivaStr}: $${vc.value.toLocaleString('es-CO')}\n`;
            finalTotal += vc.value;

            htmlPrintRows += `<tr style="background-color: #f9f9f9; font-style: italic;">
                <td>1 ud</td>
                <td>📦 (Variable) ${vc.name}</td>
                <td>$${vc.value.toLocaleString('es-CO')}/ud</td>
                <td>$${rowIvaVal.toLocaleString('es-CO')}</td>
                <td>$${vc.value.toLocaleString('es-CO')}</td>
            </tr>`;
        });
    }

    // Sumar costos fijos
    if (fixedCosts.length > 0) {
        invoiceText += `\n*Otros Costos (Fijos/Dom):*\n`;
        fixedCosts.forEach(fc => {
            let ivaStr = "";
            let rowIvaVal = 0;
            if (fc.applyIva) {
                const ivaValue = Math.round(fc.value * (taxRate / 100));
                rowIvaVal = ivaValue;
                totalIvaSum += ivaValue;
                ivaDetails.push(`- IVA ${fc.name}: $${ivaValue.toLocaleString('es-CO')}`);
                ivaStr = ` *(+IVA)*`;
            }
            invoiceText += `🛵 ${fc.name}${ivaStr}: $${fc.value.toLocaleString('es-CO')}\n`;
            finalTotal += fc.value;

            htmlPrintRows += `<tr style="background-color: #f9f9f9; font-style: italic;">
                <td>1 ud</td>
                <td>🛵 (Fijo) ${fc.name}</td>
                <td>$${fc.value.toLocaleString('es-CO')}/ud</td>
                <td>$${rowIvaVal.toLocaleString('es-CO')}</td>
                <td>$${fc.value.toLocaleString('es-CO')}</td>
            </tr>`;
        });
    }

    if (totalIvaSum > 0) {
        invoiceText += `\n⚖️ *Impuestos (IVA ${taxRate}%):*\n`;
        ivaDetails.forEach(detail => {
            invoiceText += `${detail}\n`;
        });
        invoiceText += `*Total IVA: $${totalIvaSum.toLocaleString('es-CO')}*\n`;
        finalTotal += totalIvaSum;
    }

    invoiceText += `\n━━━━━━━━━━━━━━━━━\n`;
    invoiceText += `💰 *TOTAL A PAGAR: $${finalTotal.toLocaleString('es-CO')}*\n`;
    invoiceText += `━━━━━━━━━━━━━━━━━\n\n`;
    invoiceText += `¡Gracias por tu compra! 🌱🍏`;

    document.getElementById('invoice-output').value = invoiceText;
    document.getElementById('invoice-section').style.display = 'block';

    // CONSTRUIR DOM PARA EL PDF LEGAL
    const printArea = document.getElementById('print-area');
    printArea.innerHTML = `
        <div class="print-header">
            <h1>${cName}</h1>
            <p>NIT/RUT: ${cNit}</p>
            <p>Teléfono: ${cPhone}</p>
            <p>Fecha de Expedición: ${pDate}</p>
        </div>
        <table class="print-table">
            <thead>
                <tr>
                    <th>Cant/Und</th>
                    <th>Producto/Concepto</th>
                    <th>V. Unitario</th>
                    <th>Sub. IVA</th>
                    <th>Subtotal</th>
                </tr>
            </thead>
            <tbody>
                ${htmlPrintRows}
            </tbody>
        </table>
        <table class="print-totals">
            <tr><td>Subtotal de Productos:</td><td>$${itemsTotal.toLocaleString('es-CO')}</td></tr>
            <tr><td>Costos Extra (Variables y Domicilios):</td><td>$${(finalTotal - itemsTotal - totalIvaSum).toLocaleString('es-CO')}</td></tr>
            <tr><td>Total Impuestos Declarados (IVA):</td><td>$${totalIvaSum.toLocaleString('es-CO')}</td></tr>
            <tr class="total-row"><td>TOTAL A PAGAR:</td><td>$${finalTotal.toLocaleString('es-CO')}</td></tr>
        </table>
        <div class="print-footer">
            ¡Mil gracias por preferirnos! 🌱 Factura u orden de cobro generada automáticamente.
        </div>
    `;

    // Scroll a la sección
    document.getElementById('invoice-section').scrollIntoView({ behavior: 'smooth' });
}

// Copia la factura al portapapeles
function copyInvoice() {
    const text = document.getElementById('invoice-output');
    text.select();
    text.setSelectionRange(0, 99999); /* Para dispositivos móviles */

    navigator.clipboard.writeText(text.value).then(() => {
        alert("¡Factura copiada al portapapeles! Ya puedes pegarla en WhatsApp.");
    }).catch(err => {
        alert("No se pudo copiar automáticamente. Por favor cópiala manualmente.");
    });
}

// Añade una fila vacía manualmente
function addManualItem() {
    const marginValue = parseFloat(document.getElementById('profit-margin').value) || 0;
    const index = Date.now(); // ID virtual único usando timestamp

    // Lo añadimos al arreglo
    currentParsedItems.push({
        id: index,
        originalLine: "Añadido Manualmente",
        product: null,
        qty: 1,
        unit: 'unidad',
        unknownName: ""
    });

    const reviewTbody = document.getElementById('review-tbody');
    const tr = document.createElement('tr');

    const unitOptions = ['kg', 'gr', 'unidad', 'paquete'].map(u =>
        `<option value="${u}">${u}</option>`
    ).join('');

    tr.innerHTML = `
        <td><small>Añadido Manualmente</small></td>
        <td>
            <input type="text" id="prod-${index}" list="global-products-list" value="" style="width: 100%; padding: 5px;" placeholder="Escribe para buscar o añade..." onchange="onProductSelectChange(${index}); updateRow(${index})">
            <span id="prov-badge-${index}"><div style="color: #0288D1; font-size: 0.75rem; margin-top: 4px;">🏢 Desconocido</div></span>
        </td>
        <td><input type="number" id="qty-${index}" value="1" step="0.1" min="0.1" style="width: 70px" onchange="updateRow(${index})"></td>
        <td><select id="unit-${index}" onchange="updateRow(${index})">${unitOptions}</select></td>
        <td>$<input type="number" id="price-${index}" value="0" style="width: 90px" onchange="updateRow(${index})"></td>
        <td id="sub-${index}">$0</td>
        <td style="text-align:center;"><input type="checkbox" id="iva-${index}" style="transform:scale(1.2); cursor:pointer;"></td>
        <td><button class="btn-remove" onclick="removeRow(${index}, this)">🗑️</button></td>
    `;

    reviewTbody.appendChild(tr);
}

// Reinicia la aplicación para un nuevo pedido
function resetOrder() {
    if (!confirm('¿Estás seguro de que deseas iniciar un nuevo pedido? Se borrarán los datos actuales.')) return;

    // Limpia el input
    document.getElementById('whatsapp-input').value = '';

    // Limpia tabla y arreglo
    currentParsedItems = [];
    document.getElementById('review-tbody').innerHTML = '';

    // Oculta secciones
    document.getElementById('review-section').style.display = 'none';
    document.getElementById('invoice-section').style.display = 'none';

    // Hace scroll automático al área de ingreso
    document.querySelector('main').scrollIntoView({ behavior: 'smooth' });
}

/**
 * ==========================================
 * SOPORTE PARA DICTADO POR VOZ (Web Speech API)
 * ==========================================
 */
let recognition = null;
let isRecording = false;
let sessionOriginalText = "";
let stableTranscript = "";

function toggleVoiceInput() {
    const micBtn = document.getElementById('mic-btn');
    const textarea = document.getElementById('whatsapp-input');

    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        alert("Lo siento, tu navegador no soporta el reconocimiento de voz. Intenta utilizar Google Chrome o Safari (actualizados).");
        return;
    }

    if (isRecording) {
        recognition.stop();
        return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'es-CO'; // Optimizado para español latino

    recognition.onstart = () => {
        isRecording = true;
        micBtn.innerHTML = '🛑 Escuchando...';
        micBtn.classList.add('recording-pulse');

        sessionOriginalText = textarea.value;
        if (sessionOriginalText.trim().length > 0 && !sessionOriginalText.endsWith('\n')) {
            sessionOriginalText += '\n'; // Salto de línea limpio si ya había código
        }
        stableTranscript = "";
    };

    recognition.onresult = (event) => {
        let interimTranscript = '';
        let currentFinal = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
                currentFinal += event.results[i][0].transcript + '\n';
            } else {
                interimTranscript += event.results[i][0].transcript;
            }
        }

        stableTranscript += currentFinal;
        textarea.value = sessionOriginalText + stableTranscript + interimTranscript;

        // Mantener el scroll al final mientras se dicta para no perderse
        textarea.scrollTop = textarea.scrollHeight;
    };

    recognition.onerror = (event) => {
        console.error("Error de voz: ", event.error);
        stopRecordingVisuals();
    };

    recognition.onend = () => {
        stopRecordingVisuals();
    };

    function stopRecordingVisuals() {
        isRecording = false;
        micBtn.innerHTML = '🎙️ Dictar por Voz';
        micBtn.classList.remove('recording-pulse');
    }

    recognition.start();
}

function exportToPDF() {
    window.print();
}

/**
 * ==========================================
 * ECOSISTEMA 2: GESTIÓN DE PROVEEDORES
 * ==========================================
 * Estructuras 100% aisladas del flujo regular de clientes/facturas.
 */

// 1. Tablas en Memoria Local (Persistencia)
let PROVIDERS_DB = JSON.parse(localStorage.getItem('PROVIDERS_DB')) || [
    { id: 1, name: "Mercado Zonal Mayorista" },
    { id: 2, name: "Don Pedro Campos" }
];

let QUOTES_DB = JSON.parse(localStorage.getItem('QUOTES_DB')) || [];
let APPROVAL_HISTORY = JSON.parse(localStorage.getItem('APPROVAL_HISTORY')) || [];
let MODIFIED_BASE_COSTS = JSON.parse(localStorage.getItem('MODIFIED_BASE_COSTS')) || {};
let ACTIVE_PROVIDERS = JSON.parse(localStorage.getItem('ACTIVE_PROVIDERS')) || {};

// Rutina Maestra de Grabado
function saveAllToLocal() {
    localStorage.setItem('PROVIDERS_DB', JSON.stringify(PROVIDERS_DB));
    localStorage.setItem('QUOTES_DB', JSON.stringify(QUOTES_DB));
    localStorage.setItem('APPROVAL_HISTORY', JSON.stringify(APPROVAL_HISTORY));
    localStorage.setItem('MODIFIED_BASE_COSTS', JSON.stringify(MODIFIED_BASE_COSTS));
    localStorage.setItem('ACTIVE_PROVIDERS', JSON.stringify(ACTIVE_PROVIDERS));
}

// 2. Controladores de la Interfaz del Modal
function openProvidersModal() {
    document.getElementById('providers-modal').style.display = 'flex';
    document.body.style.overflow = 'hidden'; // Previene scroll de fondo
    renderProvidersList();
    renderProvidersDatalist();
}

function closeProvidersModal() {
    document.getElementById('providers-modal').style.display = 'none';
    document.body.style.overflow = 'auto'; // Restaura scroll normal
}

function switchProviderTab(tabNum) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.style.display = 'none');

    document.querySelectorAll('.tab-btn')[tabNum - 1].classList.add('active');
    document.getElementById(`prov-tab-${tabNum}`).style.display = 'block';

    if (tabNum === 1) renderProvidersList();
    if (tabNum === 3) renderHistoryList();
}

// 3. Pestaña 1: Manejo de Proveedores (Catálogo y Mini-Inventarios)
let currentViewProviderId = null;

function renderProvidersList() {
    const tbody = document.getElementById('providers-list-tbody');
    tbody.innerHTML = '';
    PROVIDERS_DB.forEach(p => {
        const qtyQuotes = QUOTES_DB.filter(q => q.providerId === p.id).length;
        tbody.innerHTML += `<tr>
            <td>#${p.id}</td>
            <td><b>${p.name}</b><br><small style="color:#777;">${qtyQuotes} productos en oferta</small></td>
            <td>
                <button class="btn btn-small" style="background:#0288D1; color:white; width: 100%; margin-bottom:5px;" onclick="viewProviderInventory(${p.id})">📦 Ver Inventario</button>
                <button class="btn-remove" style="width: 100%;" onclick="removeProvider(${p.id})">Eliminar Proveedor</button>
            </td>
        </tr>`;
    });
}

function viewProviderInventory(provId) {
    currentViewProviderId = provId;
    const p = PROVIDERS_DB.find(prov => prov.id === provId);
    document.getElementById('inv-provider-title').innerText = `📦 Inventario de: ${p.name}`;

    document.getElementById('prov-list-view').style.display = 'none';
    document.getElementById('prov-inventory-view').style.display = 'block';

    renderProviderInventory();
}

function backToProvidersList() {
    currentViewProviderId = null;
    document.getElementById('prov-list-view').style.display = 'block';
    document.getElementById('prov-inventory-view').style.display = 'none';
    renderProvidersList();
}

function renderProviderInventory() {
    if (!currentViewProviderId) return;
    const tbody = document.getElementById('prov-inventory-tbody');
    const quotes = QUOTES_DB.filter(q => q.providerId === currentViewProviderId);

    tbody.innerHTML = '';
    if (quotes.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;">Proveedor no tiene productos en inventario. Añade arriba 👆</td></tr>`;
        return;
    }

    quotes.forEach(q => {
        const prod = PRODUCTS_DB.find(p => p.id === q.productId);
        const pName = prod ? prod.name : 'Desc';
        const unit = prod ? prod.unit : 'ud';
        tbody.innerHTML += `<tr>
            <td><b>${pName}</b></td>
            <td style="font-weight:bold;">$${q.quotedPrice.toLocaleString('es-CO')} / ${unit}</td>
            <td style="font-size:0.8rem; color:#888;">${q.date}</td>
            <td style="min-width: 110px;">
                <button class="btn btn-small" style="background:#0288D1; color:#fff; width:100%; margin-bottom:5px;" onclick="approveNewBaseCost(${q.productId}, ${q.providerId}, ${q.quotedPrice}, ${prod ? prod.baseCost : 0})">✔ Fijar Oficial</button>
                <div style="display:flex; gap:5px;">
                    <button class="btn btn-small" style="background:#ECEFF1; color:#000; flex:1; margin:0; padding:5px;" onclick="editInventoryQuote('${pName}', ${q.quotedPrice})">✏️ Editar</button>
                    <button class="btn btn-small" style="background:#d32f2f; color:#fff; margin:0; padding:5px 10px;" onclick="deleteInventoryQuote(${q.productId})" title="Eliminar oferta">🗑️</button>
                </div>
            </td>
        </tr>`;
    });
}

function deleteInventoryQuote(productId) {
    if (!confirm("¿Deseas eliminar permanentemente esta oferta del portafolio actual de este proveedor?")) return;
    QUOTES_DB = QUOTES_DB.filter(q => !(q.productId === productId && q.providerId === currentViewProviderId));
    saveAllToLocal();
    renderProviderInventory();
    loadProductQuotes(); // Refresca en background
}

function printProviderInventoryPDF() {
    if (!currentViewProviderId) return;
    const p = PROVIDERS_DB.find(prov => prov.id === currentViewProviderId);
    if (!p) return;

    const quotes = QUOTES_DB.filter(q => q.providerId === currentViewProviderId);
    if (quotes.length === 0) return alert("El proveedor no tiene productos asignados para imprimir.");

    const printArea = document.getElementById('print-area');
    let htmlPrint = `
        <div class="print-header">
            <h2 style="margin-bottom:0;">📃 Portafolio y Acuerdo Comercial</h2>
            <p style="font-size:1.2rem; font-weight:bold;">Socio Proveedor: ${p.name}</p>
            <p>Fecha Generación: ${new Date().toLocaleDateString('es-CO')}</p>
        </div>
        <table class="print-table">
            <thead>
                <tr>
                    <th>Ref</th>
                    <th>Producto Agrícola</th>
                    <th>Cotización / Unidad Física</th>
                    <th>Rastreo (Última Act.)</th>
                </tr>
            </thead>
            <tbody>
    `;

    quotes.forEach(q => {
        const prod = PRODUCTS_DB.find(prod => prod.id === q.productId);
        const pName = prod ? prod.name : 'Desconocido';
        const unit = prod ? prod.unit : 'ud';
        htmlPrint += `
            <tr>
                <td>#${q.productId}</td>
                <td><b>${pName}</b></td>
                <td style="font-weight:bold;">$${q.quotedPrice.toLocaleString('es-CO')} / ${unit}</td>
                <td style="font-style:italic;">${q.date}</td>
            </tr>
        `;
    });

    htmlPrint += `
            </tbody>
        </table>
        <div class="print-footer" style="margin-top: 50px;">
            <table style="width:100%; border:none;">
                <tr style="border:none;">
                    <td style="text-align:center; border:none; padding:30px;">___________________________<br>Firma Legal (Agente Proveedor)</td>
                    <td style="text-align:center; border:none; padding:30px;">___________________________<br>Firma Verificada Local </td>
                </tr>
            </table>
        </div>
    `;

    printArea.innerHTML = htmlPrint;
    document.body.classList.add('printing-providers');
    setTimeout(() => {
        window.print();
        document.body.classList.remove('printing-providers');
    }, 150);
}

function editInventoryQuote(pName, currentPrice) {
    document.getElementById('inv-product-input').value = pName;
    document.getElementById('inv-price-input').value = currentPrice;
    document.getElementById('inv-price-input').focus();
}

function saveInventoryQuote() {
    if (!currentViewProviderId) return;
    const productName = document.getElementById('inv-product-input').value.trim();
    const product = PRODUCTS_DB.find(p => p.name.toLowerCase() === productName.toLowerCase());
    const newPrice = parseFloat(document.getElementById('inv-price-input').value);

    if (!product) return alert("Escribe un producto válido del catálogo general.");
    if (!newPrice || newPrice <= 0) return alert("El precio debe ser superior a $0.");

    const existing = QUOTES_DB.find(q => q.productId === product.id && q.providerId === currentViewProviderId);
    const hoy = new Date().toLocaleDateString();

    if (existing) {
        existing.quotedPrice = newPrice;
        existing.date = hoy;
    } else {
        QUOTES_DB.push({ productId: product.id, providerId: currentViewProviderId, quotedPrice: newPrice, date: hoy });
    }
    saveAllToLocal();

    document.getElementById('inv-product-input').value = '';
    document.getElementById('inv-price-input').value = '';

    renderProviderInventory();
    loadProductQuotes(); // Refresca pestaña cotizador global por si acaso
}

function addProvider() {
    const input = document.getElementById('new-prov-name');
    const name = input.value.trim();
    if (!name) return alert("Ingresa un nombre de proveedor.");

    const newId = PROVIDERS_DB.length > 0 ? Math.max(...PROVIDERS_DB.map(p => p.id)) + 1 : 1;
    PROVIDERS_DB.push({ id: newId, name });
    saveAllToLocal();

    input.value = '';
    renderProvidersList();
    renderProvidersDatalist();
}

function removeProvider(id) {
    if (!confirm("¿Deseas ELIMINAR a este proveedor? Se perderán también sus cotizaciones.")) return;
    PROVIDERS_DB = PROVIDERS_DB.filter(p => p.id !== id);
    QUOTES_DB = QUOTES_DB.filter(q => q.providerId !== id);
    saveAllToLocal();

    renderProvidersList();
    renderProvidersDatalist();
    loadProductQuotes(); // Refresca grilla por si estaba validando
}

function renderProvidersDatalist() {
    let datalist = document.getElementById('global-providers-list');
    if (!datalist) {
        datalist = document.createElement('datalist');
        datalist.id = "global-providers-list";
        document.body.appendChild(datalist);
    }
    datalist.innerHTML = '';
    PROVIDERS_DB.forEach(p => {
        const option = document.createElement('option');
        option.value = p.name;
        datalist.appendChild(option);
    });
}

// 4. Pestaña 2: Cotizador Inteligente y Medallas
function loadProductQuotes() {
    const productName = document.getElementById('quote-product-input').value.trim();
    const product = PRODUCTS_DB.find(p => p.name.toLowerCase() === productName.toLowerCase());

    const costInput = document.getElementById('quote-current-cost');
    const tbody = document.getElementById('quotes-tbody');

    if (!product) {
        costInput.value = "N/A (Buscar en el catálogo)";
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Digita o busca un producto válido primero.</td></tr>';
        return;
    }

    costInput.value = `$${product.baseCost.toLocaleString('es-CO')} / ${product.unit}`;

    const quotes = QUOTES_DB.filter(q => q.productId === product.id);

    if (quotes.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">No hay cotizaciones para este producto registradas aún. Añade una arriba.</td></tr>';
        return;
    }

    // Algoritmo de "Rival más Fuerte": Evalúa el menor costo
    let bestQuote = quotes.reduce((prev, curr) => (curr.quotedPrice < prev.quotedPrice ? curr : prev));

    tbody.innerHTML = '';
    quotes.forEach(q => {
        const prov = PROVIDERS_DB.find(p => p.id === q.providerId);
        const pName = prov ? prov.name : 'Desconocido/Borrado';
        const diff = q.quotedPrice - product.baseCost;

        let diffColor = diff < 0 ? '#388E3C' : (diff > 0 ? '#D32F2F' : '#555');
        let diffText = diff < 0 ? `👇 Ahorras $${Math.abs(diff)}` : (diff > 0 ? `👆 Pagas $${diff} extra` : '(=) Empate Neutro');

        const isWinner = q === bestQuote;
        const rowClass = isWinner ? 'winner-row' : '';
        const badge = isWinner ? `<span class="winner-badge">🏆 Mejor Opción</span>` : '';

        let actionBtn = "";
        // Evaluación Legal: ¿Es ya el proveedor oficial de facto?
        if (q.quotedPrice !== product.baseCost) {
            actionBtn = `<button class="btn btn-small" style="background:#0288D1; color:white; width:100%; margin-bottom:5px;" onclick="approveNewBaseCost(${product.id}, ${q.providerId}, ${q.quotedPrice}, ${product.baseCost})">✔ Aprobar Como Proveedor Oficial</button>`;
        } else {
            actionBtn = `<span style="font-size:0.8rem; color:#666; font-weight:bold; display:block; margin-bottom:5px;">📋 Proveedor Oficial Actual</span>`;
        }

        // Cross-Ecosystems: Carrito
        actionBtn += `<button class="btn btn-small" style="background:#fbc02d; color:#000; width:100%;" onclick="addToCrossCart('${product.name}', ${q.quotedPrice}, '${product.unit}')">🛒 Cargar Variante a WhatsApp</button>`;

        const unit = product ? product.unit : 'ud';
        tbody.innerHTML += `<tr class="${rowClass}">
            <td><b>${pName}</b> ${badge}<br><small style="color:#888;">Ingresado: ${q.date}</small></td>
            <td style="font-size:1.1rem; font-weight:bold;">$${q.quotedPrice.toLocaleString('es-CO')} / ${unit}</td>
            <td style="color:${diffColor}; font-weight:bold;">${diffText}</td>
            <td>${actionBtn}</td>
        </tr>`;
    });
}

function saveQuote() {
    const productName = document.getElementById('quote-product-input').value.trim();
    const product = PRODUCTS_DB.find(p => p.name.toLowerCase() === productName.toLowerCase());
    const provNameInput = document.getElementById('quote-provider-input').value.trim();
    const provider = PROVIDERS_DB.find(p => p.name.toLowerCase() === provNameInput.toLowerCase());
    const newPrice = parseFloat(document.getElementById('quote-price').value);

    if (!product) return alert("Primero selecciona un producto válido del catálogo agrícola.");
    if (!provider) return alert("Ese proveedor no existe. Búscalo o créalo en la Pestaña 1 primero.");
    if (!newPrice || newPrice <= 0) return alert("El costo de oferta debe ser válido y superior a $0.");

    const existing = QUOTES_DB.find(q => q.productId === product.id && q.providerId === provider.id);
    const hoy = new Date().toLocaleDateString();

    // Actualiza o inserta la cotización
    if (existing) {
        existing.quotedPrice = newPrice;
        existing.date = hoy;
    } else {
        QUOTES_DB.push({ productId: product.id, providerId: provider.id, quotedPrice: newPrice, date: hoy });
    }
    saveAllToLocal();

    document.getElementById('quote-price').value = '';
    document.getElementById('quote-provider-input').value = '';
    alert(`👍 Oferta registrada exitosamente en el Inventario Individual de ${provider.name}.`);
    loadProductQuotes(); // Re-imprimir tablero visual
}

function approveNewBaseCost(productId, providerId, newPrice, oldPrice) {
    if (!confirm(`¡OJO! Al aprobarlo, sustituirás permanentemente tu costo agrícola interno actual de $${oldPrice} por la tarifa oferta de $${newPrice}.\n\nEsto impactará los precios facturados a tus clientes en adelante si usas Márgenes Automáticos.\n\n¿Estás seguro de efectuar la modificación general?`)) return;

    const product = PRODUCTS_DB.find(p => p.id === productId);
    if (!product) return;

    // Mutamos el objeto por referencia y guardamos en memoria no volátil
    product.baseCost = newPrice;
    MODIFIED_BASE_COSTS[product.id] = newPrice;

    // Trazabilidad de Auditoría
    const prov = PROVIDERS_DB.find(p => p.id === providerId);

    // Vinculación global para el visualizador del facturador
    ACTIVE_PROVIDERS[product.id] = prov ? prov.name : '';

    APPROVAL_HISTORY.push({
        date: new Date().toLocaleString('es-CO'),
        productName: product.name,
        providerName: prov ? prov.name : 'Desconocido/Borrado',
        oldPrice: oldPrice,
        newPrice: newPrice
    });
    saveAllToLocal();

    alert("✅ ¡Decisión de Negocio Aprobada! El costo matriz del producto fue recalculado y el historial fue blindado para auditorías.");
    loadProductQuotes();
}

// 5. Convergencia Paralela (Mandar al Ecosistema WhatsApp 1)
function addToCrossCart(productName, quotedCostPrice, unit) {
    const marginValue = parseFloat(document.getElementById('profit-margin').value) || 0;
    // Si metemos a la canasta final de la Factura, hay que sumarle nuestro margen para venderlo
    const sellPrice = Math.round(quotedCostPrice * (1 + (marginValue / 100)));

    const index = Date.now();

    // Inyecta a la memoria core del DOM externo
    currentParsedItems.push({
        id: index,
        originalLine: `Añadido desde Proveedor (Costo Real $${quotedCostPrice})`,
        product: PRODUCTS_DB.find(p => p.name === productName),
        qty: 1,
        unit: unit,
        unknownName: productName
    });

    // Inyectamos fila manual para sincronizar pantalla externa
    const reviewTbody = document.getElementById('review-tbody');
    const tr = document.createElement('tr');

    const unitOptions = ['kg', 'gr', 'unidad', 'paquete'].map(u =>
        `<option value="${u}" ${u === unit ? 'selected' : ''}>${u}</option>`
    ).join('');

    tr.innerHTML = `
        <td><small style="color:#d32f2f; font-weight:bold;">Cotizador Externo</small></td>
        <td>
            <input type="text" id="prod-${index}" list="global-products-list" value="${productName}" style="width: 100%; padding: 5px;" onchange="onProductSelectChange(${index}); updateRow(${index})">
        </td>
        <td><input type="number" id="qty-${index}" value="1" step="0.1" min="0.1" style="width: 70px" onchange="updateRow(${index})"></td>
        <td><select id="unit-${index}" onchange="updateRow(${index})">${unitOptions}</select></td>
        <td>$<input type="number" id="price-${index}" value="${sellPrice}" style="width: 90px" onchange="updateRow(${index})"></td>
        <td id="sub-${index}">$${sellPrice}</td>
        <td style="text-align:center;"><input type="checkbox" id="iva-${index}" style="transform:scale(1.2); cursor:pointer;"></td>
        <td><button class="btn-remove" onclick="removeRow(${index}, this)">🗑️</button></td>
    `;

    reviewTbody.appendChild(tr);
    document.getElementById('review-section').style.display = 'block';

    alert(`🛒  ¡Vendido a precio ofertado! \nEste ítem (a precio final de $${sellPrice} con margen) ya aterrizó en la página verde de validación de WhatsApp al fondo.`);
}

// 6. Reportes y Traceback de Auditoría en PDF Local
function renderHistoryList() {
    const tbody = document.getElementById('history-tbody');
    if (APPROVAL_HISTORY.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:#999;">Aún no existen historiales de modificación en tu núcleo local.</td></tr>';
        return;
    }

    tbody.innerHTML = '';
    // Reverseamos el array visiblemente para ver los más nuevos arriba
    [...APPROVAL_HISTORY].reverse().forEach(h => {
        tbody.innerHTML += `<tr>
            <td style="font-size:0.85rem;">${h.date}</td>
            <td><b>${h.productName}</b></td>
            <td>${h.providerName}</td>
            <td>Cambió costo base de <strike>$${h.oldPrice}</strike> a <b>$${h.newPrice}</b></td>
        </tr>`;
    });
}

function printProvidersHistoryPDF() {
    if (APPROVAL_HISTORY.length === 0) {
        return alert("⚠️ El historial de manipulación contable está vacío. Nada que plasmar en el PDF.");
    }

    const printArea = document.getElementById('print-area');

    let htmlTrace = `
        <div class="print-header">
            <h1>🏢 AUDITORÍA ESTRICTA DE PROVEEDORES</h1>
            <p>Reporte de Cambios de Costo Base Oficiales Autorizados Directamente</p>
            <p>Fecha Cierre Emisión: ${new Date().toLocaleString('es-CO')}</p>
        </div>
        <table class="print-table">
            <thead>
                <tr>
                    <th>Fecha de la Transacción de Mercado</th>
                    <th>Producto Validado (Target)</th>
                    <th>Proveedor Legal Oferente (Ganador)</th>
                    <th>Costo Base Interno Anterior</th>
                    <th>Nuevo Costo Base Intercedido</th>
                </tr>
            </thead>
            <tbody>
    `;

    [...APPROVAL_HISTORY].reverse().forEach(h => {
        htmlTrace += `<tr>
            <td>${h.date}</td>
            <td><b>${h.productName}</b></td>
            <td>${h.providerName}</td>
            <td><strike style="color:#d32f2f;">$${h.oldPrice.toLocaleString('es-CO')}</strike></td>
            <td><b style="color:#2E7D32;">$${h.newPrice.toLocaleString('es-CO')}</b></td>
        </tr>`;
    });

    htmlTrace += `</tbody></table>
        <div class="print-footer" style="text-align: left; margin-top: 50px;">
            _________________________________<br>Firma del Administrador Legal Auditor.
        </div>
    `;

    printArea.innerHTML = htmlTrace;

    document.body.classList.add('printing-providers');

    // Tiempo aire para aplicar la regla mágica de CSS modal override
    setTimeout(() => {
        window.print();
        document.body.classList.remove('printing-providers');
    }, 150);
}

function clearProvidersHistory() {
    if (!confirm("¿Estás seguro de que deseas limpiar y reiniciar todo el historial mensual legal de auditoría?\n\n(No te preocupes, esto NO borrará los nombres de proveedores ni reiniciará los costos que modificaste hoy, solo limpiará el listado que se imprime en el PDF para permitirte arrancar un nuevo mes).")) return;

    APPROVAL_HISTORY = [];
    saveAllToLocal();
    renderHistoryList();
    alert("Historial de Seguimiento Reiniciado exitosamente.");
}
