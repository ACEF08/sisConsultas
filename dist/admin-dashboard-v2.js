
import { db, auth } from './firebase-config.js';
import {
  getDoc, collection, getDocs, doc, updateDoc, deleteDoc, onSnapshot, query, where
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";

// --- Elementos DOM ---
const adminUserInfo = document.getElementById('admin-user-info');
const logoutButton = document.getElementById('logout-button');
const tableWrapper = document.getElementById('table-wrapper');
const toastContainer = document.getElementById('toast-container');

const filterStatus = document.getElementById('filter-status');
const filterDni = document.getElementById('filter-dni');
const filterEstablecimiento = document.getElementById('filter-establecimiento');
const exportExcelButton = document.getElementById('export-excel');
const paginationControls = document.getElementById('pagination-controls');

const attendModal = document.getElementById('attend-modal');
const userDetailsModal = document.getElementById('user-details-modal');

// --- Estado ---
let allQueries = [];
let originalQueries = [];
let allUsers = {};
let allPersonal = {};
let currentQueryId = null;
let currentUserRole = null;
let initialLoad = true;
let currentPage = 1;
const rowsPerPage = 10;
let realtimeUnsubscribe = null;

// ==================== TOAST FUNCTION (IDÉNTICA AL DASHBOARD) ====================
function showToast(message, type = "success") {
  const toast = document.createElement("div");
  toast.className = `flex items-center w-full max-w-sm p-4 mb-4 text-gray-900 bg-white rounded-lg shadow border ${
    type === "error" ? "border-red-500" : "border-green-500"
  }`;
  toast.innerHTML = `
    <div class="ml-3 text-sm font-normal">${message}</div>
    <button type="button" class="ml-auto -mx-1.5 -my-1.5 rounded-lg p-1.5 inline-flex h-8 w-8">
      <i data-lucide="x" class="h-5 w-5"></i>
    </button>
  `;
  toastContainer.appendChild(toast);
  lucide.createIcons();

  toast.querySelector("button").onclick = () => toast.remove();
  setTimeout(() => {
    if (toast.isConnected) toast.remove();
  }, 5000);
}
// ==============================================================================

// === AUTENTICACIÓN ===
onAuthStateChanged(auth, async (user) => {
  if (user) {
    await loadAdminData(user.uid);
    await loadAuxiliaryData();
    await setupRealtimeListener();
    setupFilters();
    setupModalListeners();
  } else {
    window.location.href = 'admin-login.html';
  }
});

async function loadAdminData(uid) {
    const adminDoc = await getDoc(doc(db, 'personal', uid));
    if (adminDoc.exists()) {
        const data = adminDoc.data();
        currentUserRole = data.rol || 'quimico';
        const userInitial = data.nombre ? data.nombre.charAt(0).toUpperCase() : '?';

        adminUserInfo.innerHTML = `
            <span class="relative flex shrink-0 overflow-hidden rounded-full h-8 w-8 bg-sidebar-accent text-sidebar-accent-foreground text-xs font-bold items-center justify-center ring-2 ring-sidebar-ring">
                ${userInitial}
            </span>
            <div class="flex-grow min-w-0">
                <p class="font-semibold truncate text-sidebar-primary">${data.nombre}</p>
                <p class="text-xs text-sidebar-foreground/70 capitalize">${currentUserRole}</p>
            </div>
        `;
    } else {
        showToast("Acceso denegado. No eres parte del personal autorizado.", "error");
        signOut(auth).then(() => window.location.href = 'admin-login.html');
    }
}

async function loadAuxiliaryData() {
    const [usersSnap, personalSnap] = await Promise.all([
        getDocs(collection(db, "users")),
        getDocs(collection(db, "personal"))
    ]);
    usersSnap.forEach(d => allUsers[d.id] = { ...d.data(), id: d.id });
    personalSnap.forEach(d => allPersonal[d.id] = d.data());
}

function setupRealtimeListener() {
    let q = query(collection(db, "queries"));
    const userRole = (currentUserRole || '').toLowerCase();

    if (userRole.includes('quimico')) {
        q = query(collection(db, "queries"), where("asignadoA", "==", auth.currentUser.uid));
    }

    if (realtimeUnsubscribe) realtimeUnsubscribe();

    realtimeUnsubscribe = onSnapshot(q, (snapshot) => {
        const changedDocs = snapshot.docChanges();
        
        if (initialLoad) {
            originalQueries = snapshot.docs
              .map(d => ({ id: d.id, ...d.data() }))
              .sort((a, b) => (b.fechaCreacion?.seconds ?? 0) - (a.fechaCreacion?.seconds ?? 0));
            initialLoad = false;
        } else {
            changedDocs.forEach(change => {
                const queryData = { id: change.doc.id, ...change.doc.data() };
                if (change.type === "added" && !originalQueries.some(q => q.id === queryData.id)) {
                    showToast(`Nueva consulta recibida sobre ${queryData.tema || 'sin tema'}`, "success");
                    originalQueries.unshift(queryData); 
                }
                if (change.type === "modified") {
                    const index = originalQueries.findIndex(q => q.id === queryData.id);
                    if (index > -1) originalQueries[index] = queryData;
                }
                if (change.type === "removed") {
                    originalQueries = originalQueries.filter(q => q.id !== queryData.id);
                }
            });
        }
        
        originalQueries.sort((a, b) => (b.fechaCreacion?.seconds ?? 0) - (a.fechaCreacion?.seconds ?? 0));
        filterAndRenderTable();
        updateStats();

    }, (error) => {
        console.error("Error en tiempo real:", error);
        showToast("Error de conexión con la base de datos.", "error");
        tableWrapper.innerHTML = `<p class="text-center text-red-600 py-8">Error de conexión.</p>`;
    });
}

function setupFilters() {
    [filterStatus, filterDni, filterEstablecimiento].forEach(el => {
        el.addEventListener(el.tagName === 'SELECT' ? 'change' : 'input', () => {
            currentPage = 1;
            filterAndRenderTable();
        });
    });
    exportExcelButton.addEventListener('click', exportToExcel);
    logoutButton.addEventListener('click', () => signOut(auth));
}

function filterAndRenderTable() {
    const status = filterStatus.value;
    const dni = filterDni.value.toLowerCase();
    const establecimiento = filterEstablecimiento.value.toLowerCase();

    allQueries = originalQueries.filter(q => {
        const user = allUsers[q.userId] || {};
        return (!status || q.status === status) &&
               (!dni || (user.dni && user.dni.toLowerCase().includes(dni))) &&
               (!establecimiento || (q.nombreEstablecimiento && q.nombreEstablecimiento.toLowerCase().includes(establecimiento)));
    });

    renderTable();
    renderPagination();
}

function updateStats() {
    document.getElementById('total-count').textContent = originalQueries.length;
    document.getElementById('pending-count').textContent = originalQueries.filter(q => q.status === 'Pendiente').length;
    document.getElementById('assigned-count').textContent = originalQueries.filter(q => q.status === 'Asignado').length;
    document.getElementById('attended-count').textContent = originalQueries.filter(q => q.status === 'Atendido').length;
}

function renderTable() {
    const paginatedQueries = allQueries.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);
    
    if (allQueries.length === 0) {
        tableWrapper.innerHTML = `<div class="text-center py-12 text-muted-foreground">No hay consultas que coincidan con los filtros.</div>`;
        return;
    }

    const rows = paginatedQueries.map(createRowHtml).join('');
    
    tableWrapper.innerHTML = `
        <div class="relative w-full overflow-auto">
            <table class="w-full caption-bottom text-sm">
                <thead class="[&_tr]:border-b">
                    <tr class="border-b transition-colors hover:bg-muted/50">
                        <th class="h-12 px-4 text-left align-middle font-medium text-muted-foreground min-w-[200px]">Usuario (DNI)</th>
                        <th class="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Cargo</th>
                        <th class="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Expediente</th>
                        <th class="h-12 px-4 text-left align-middle font-medium text-muted-foreground min-w-[250px]">Establecimiento</th>
                        <th class="h-12 px-4 text-left align-middle font-medium text-muted-foreground min-w-[250px]">Tema</th>
                        <th class="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Estado</th>
                        <th class="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Asignado A</th>
                        <th class="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Fecha</th>
                        <th class="h-12 px-4 align-middle font-medium text-muted-foreground text-right">Acciones</th>
                    </tr>
                </thead>
                <tbody class="[&_tr:last-child]:border-0">${rows}</tbody>
            </table>
        </div>`;
    lucide.createIcons();
}

function createRowHtml(q) {
    const user = allUsers[q.userId] || { nombres: 'N/A', apellidos: '', dni: 'N/A', cargo: 'No especificado' };
    const assigned = allPersonal[q.asignadoA] || { nombre: 'No asignado' };
    const fecha = q.fechaCreacion?.seconds ? new Date(q.fechaCreacion.seconds * 1000).toLocaleString('es-PE') : 'Invalid Date';
    
    const userRole = (currentUserRole || '').toLowerCase();
    const isAdmin = userRole.includes('admin');
    const isSecretaria = userRole.includes('secretaria');
    const isQuimico = userRole.includes('quimico');

    const statusClasses = {
        'Pendiente': "bg-red-100 text-red-800 border-red-200",
        'Asignado': "bg-yellow-100 text-yellow-800 border-yellow-200",
        'Atendido': "bg-green-100 text-green-800 border-green-200",
    }[q.status] || "bg-gray-100 text-gray-800";

    const attendButton = `<button data-action="attend" data-query-id="${q.id}" class="inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 h-9 rounded-md px-3 bg-green-600 hover:bg-green-700 text-white"><i data-lucide="send" class="mr-2 h-4 w-4"></i>Atender</button>`;
    const viewButton = `<button data-action="view" data-query-id="${q.id}" class="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 hover:bg-accent h-8 w-8 text-primary hover:text-primary"><i data-lucide="eye" class="h-4 w-4"></i><span class="sr-only">Ver Usuario</span></button>`;
    
    let actionsHtml = '';
    
    if (isAdmin) {
        const assignOptions = Object.entries(allPersonal).filter(([id, p]) => (p.rol || '').toLowerCase().includes('quimico')).map(([id, p]) => `<div role="menuitem" class="relative flex cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent focus:text-accent-foreground" data-action="assign" data-query-id="${q.id}" data-value="${id}">${p.nombre}</div>`).join('');
        const adminMenu = `<div class="relative"><button class="action-menu-button inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium h-8 w-8 p-0 hover:bg-accent hover:text-accent-foreground"><span class="sr-only">Abrir menú</span><i data-lucide="ellipsis" class="h-4 w-4"></i></button><div class="menu hidden absolute right-0 top-full mt-2 w-64 rounded-xl border bg-popover text-popover-foreground shadow-md z-50" data-side="bottom" data-align="end"><div class="p-1"><div class="px-2 py-1.5 text-sm font-semibold">Acciones de Admin</div><div class="my-1 h-px bg-muted"></div><div class="px-2 py-1.5 text-sm font-semibold">Asignar a Químico</div><div class="flex flex-col">${assignOptions}</div><div class="my-1 h-px bg-muted"></div><div class="px-2 py-1.5 text-sm font-semibold">Cambiar Estado</div><div role="menuitem" class="relative flex cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent focus:text-accent-foreground" data-action="status" data-query-id="${q.id}" data-value="Pendiente">Marcar como Pendiente</div><div role="menuitem" class="relative flex cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent focus:text-accent-foreground" data-action="status" data-query-id="${q.id}" data-value="Atendido">Marcar como Atendido</div><div class="my-1 h-px bg-muted"></div><div role="menuitem" class="relative flex cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors text-destructive hover:bg-destructive/10 focus:text-destructive" data-action="delete" data-query-id="${q.id}"><i data-lucide="trash-2" class="mr-2 h-4 w-4"></i>Eliminar Consulta</div></div></div></div>`;
        actionsHtml = `${q.status !== 'Atendido' ? attendButton : ''}${viewButton}${adminMenu}`;
    } else if (isSecretaria) {
        const assignOptions = Object.entries(allPersonal).filter(([id, p]) => (p.rol || '').toLowerCase().includes('quimico')).map(([id, p]) => `<div role="menuitem" class="relative flex cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent focus:text-accent-foreground" data-action="assign" data-query-id="${q.id}" data-value="${id}">${p.nombre}</div>`).join('');
        const secretariaMenu = `<div class="relative"><button class="action-menu-button inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium h-8 w-8 p-0 hover:bg-accent hover:text-accent-foreground"><span class="sr-only">Abrir menú</span><i data-lucide="ellipsis" class="h-4 w-4"></i></button><div class="menu hidden absolute right-0 top-full mt-2 w-64 rounded-xl border bg-popover text-popover-foreground shadow-md z-50" data-side="bottom" data-align="end"><div class="p-1"><div class="px-2 py-1.5 text-sm font-semibold">Acciones</div><div class="my-1 h-px bg-muted"></div><div class="px-2 py-1.5 text-sm font-semibold">Asignar a Químico</div><div class="flex flex-col">${assignOptions}</div></div></div></div>`;
        actionsHtml = `${viewButton}${secretariaMenu}`;
    } else if (isQuimico) {
        actionsHtml = `${q.status !== 'Atendido' ? attendButton : ''}${viewButton}`;
    }

    return `
        <tr class="border-b hover:bg-muted/50">
            <td class="p-4 align-middle"><div class="font-medium">${user.nombres} ${user.apellidos}</div><div class="text-sm text-muted-foreground">${user.dni}</div></td>
            <td class="p-4 align-middle">${user.cargo || 'No especificado'}</td>
            <td class="p-4 align-middle">${q.expediente || '-'}</td>
            <td class="p-4 align-middle max-w-xs truncate" title="${q.nombreEstablecimiento || ''}">${q.nombreEstablecimiento || '-'}</td>
            <td class="p-4 align-middle max-w-xs truncate" title="${q.tema || ''}">${q.tema || '-'}</td>
            <td class="p-4 align-middle"><span class="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${statusClasses}">${q.status}</span></td>
            <td class="p-4 align-middle">${assigned.nombre}</td>
            <td class="p-4 align-middle">${fecha}</td>
            <td class="p-4 align-middle text-right"><div class="flex items-center justify-end gap-2">${actionsHtml}</div></td>
        </tr>`;
}

function renderPagination() {
    const totalPages = Math.ceil(allQueries.length / rowsPerPage);
    const startRecord = allQueries.length > 0 ? (currentPage - 1) * rowsPerPage + 1 : 0;
    const endRecord = Math.min(currentPage * rowsPerPage, allQueries.length);

    let paginationHtml = `<div class="text-sm text-muted-foreground">Mostrando ${startRecord} a ${endRecord} de ${allQueries.length} consultas.</div>`;

    if (totalPages > 1) {
        paginationHtml += `<div class="flex items-center space-x-2">
            <button id="prev-page" class="inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium h-9 rounded-md px-3 border" ${currentPage === 1 ? 'disabled' : ''}><i data-lucide="chevron-left" class="h-4 w-4"></i>Anterior</button>
            <span class="text-sm">Página ${currentPage} de ${totalPages}</span>
            <button id="next-page" class="inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium h-9 rounded-md px-3 border" ${currentPage === totalPages ? 'disabled' : ''}>Siguiente<i data-lucide="chevron-right" class="h-4 w-4"></i></button>
        </div>`;
    }
    
    paginationControls.innerHTML = paginationHtml;
    
    document.getElementById('prev-page')?.addEventListener('click', () => { if(currentPage > 1) { currentPage--; filterAndRenderTable(); }});
    document.getElementById('next-page')?.addEventListener('click', () => { if(currentPage < totalPages) { currentPage++; filterAndRenderTable(); }});
    lucide.createIcons();
}

function exportToExcel() {
    showToast("Generando archivo Excel...", "success");
    const data = allQueries.map(q => {
        const user = allUsers[q.userId] || {};
        return {
            'Usuario': `${user.nombres || ''} ${user.apellidos || ''}`.trim(),
            'DNI': user.dni || 'N/A',
            'Cargo': user.cargo || 'No especificado',
            'Expediente': q.expediente || '',
            'Establecimiento': q.nombreEstablecimiento || '',
            'Tema': q.tema || '',
            'Estado': q.status || 'Pendiente',
            'Asignado A': allPersonal[q.asignadoA]?.nombre || 'No asignado',
            'Fecha Registro': q.fechaCreacion ? new Date(q.fechaCreacion.seconds * 1000).toLocaleString('es-PE') : 'Sin fecha',
        };
    });
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Consultas");
    XLSX.writeFile(wb, "consultas-oacef.xlsx");
    showToast("Archivo Excel generado correctamente.", "success");
}

function setupModalListeners() {
    document.addEventListener('click', async (e) => {
        const menuBtn = e.target.closest('.action-menu-button');
        if (menuBtn) {
            const menu = menuBtn.nextElementSibling;
            document.querySelectorAll('.menu').forEach(m => {
                if (m !== menu) m.classList.add('hidden');
            });
            menu.classList.toggle('hidden');
            return;
        }
        if (!e.target.closest('.menu')) {
            document.querySelectorAll('.menu').forEach(m => m.classList.add('hidden'));
        }

        const actionTarget = e.target.closest('[data-action]');
        if (actionTarget) {
            document.querySelectorAll('.menu').forEach(m => m.classList.add('hidden'));
            
            const { action, queryId, value } = actionTarget.dataset;
            try {
                switch (action) {
                    case 'attend': 
                        openAttendModal(queryId); 
                        break;
                    case 'view': 
                        openUserDetailsModal(queryId); 
                        break;
                    case 'assign': 
                        await updateDoc(doc(db, 'queries', queryId), { asignadoA: value, status: 'Asignado' }); 
                        showToast('Consulta asignada correctamente.', "success");
                        break;
                    case 'status': 
                        await updateDoc(doc(db, 'queries', queryId), { status: value, ...(value === 'Pendiente' && { asignadoA: null }) });
                        showToast(`Estado actualizado a "${value}".`, "success");
                        break;
                    case 'delete':
                        await deleteDoc(doc(db, 'queries', queryId));
                        showToast('Consulta eliminada correctamente.', "success");
                        break;
                }
            } catch (err) { 
                console.error("Action failed:", err); 
                showToast('Error al realizar la acción.', "error"); 
            }
        }
    });
    
    document.getElementById('close-modal').addEventListener('click', closeAttendModal);
    document.getElementById('cancel-attend').addEventListener('click', closeAttendModal);
    document.getElementById('send-response').addEventListener('click', sendResponse);
    document.getElementById('close-user-modal').addEventListener('click', closeUserDetailsModal);
    document.getElementById('close-user-modal-btn').addEventListener('click', closeUserDetailsModal);
}

function openAttendModal(queryId) {
    const query = originalQueries.find(q => q.id === queryId);
    if (!query) return;
    currentQueryId = queryId;

    const user = allUsers[query.userId] || {};
    document.getElementById('modal-user').textContent = `${user.nombres || ''} ${user.apellidos || ''}`.trim() || 'N/A';
    document.getElementById('modal-dni').textContent = user.dni || 'N/A';
    document.getElementById('modal-establecimiento').textContent = query.nombreEstablecimiento || 'No especificado';
    document.getElementById('modal-expediente').textContent = query.expediente || 'Sin expediente';
    document.getElementById('modal-tema').innerHTML = query.tema || 'Sin tema';
    document.getElementById('respuesta').value = query.respuesta || '';

    attendModal.classList.remove('hidden');
    attendModal.classList.add('flex');
    lucide.createIcons();
}

function closeAttendModal() {
    attendModal.classList.add('hidden');
    attendModal.classList.remove('flex');
    currentQueryId = null;
}

async function sendResponse() {
    if (!currentQueryId) return;
    const respuesta = document.getElementById('respuesta').value.trim();
    if (!respuesta) {
        showToast('Por favor escribe una respuesta.', "error");
        return;
    }

    const btn = document.getElementById('send-response');
    btn.disabled = true;
    btn.innerHTML = 'Enviando...';

    try {
        await updateDoc(doc(db, 'queries', currentQueryId), {
            respuesta: respuesta,
            status: 'Atendido',
            fechaAtencion: new Date(),
            atendidoPor: auth.currentUser.uid
        });
        showToast('Respuesta enviada con éxito.', "success");
        closeAttendModal();
    } catch(err) {
        showToast('Error al enviar la respuesta.', "error");
        console.error(err);
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i data-lucide="send" class="h-4 w-4"></i> Enviar Respuesta';
        lucide.createIcons();
    }
}

function openUserDetailsModal(queryId) {
    const query = originalQueries.find(q => q.id === queryId);
    if (!query || !query.userId) return;
    const user = allUsers[query.userId];
    if (!user) {
        showToast('Detalles del usuario no encontrados.', "error");
        return;
    }

    document.getElementById('user-nombres').textContent = user.nombres || 'No disponible';
    document.getElementById('user-apellidos').textContent = user.apellidos || 'No disponible';
    document.getElementById('user-dni').textContent = user.dni || 'No disponible';
    document.getElementById('user-celular').textContent = user.celular || 'No registrado';
    document.getElementById('user-correo').textContent = user.correo || 'No registrado';
    document.getElementById('user-colegiatura').textContent = user.colegiatura || 'No especificado';
    document.getElementById('user-autoriza-notificaciones').textContent = user.autorizaNotificaciones ? 'Sí' : 'No';
    const fechaRegistro = user.fechaRegistro ? new Date(user.fechaRegistro.seconds * 1000).toLocaleString('es-PE') : 'No disponible';
    document.getElementById('user-registro').textContent = fechaRegistro;

    userDetailsModal.classList.remove('hidden');
    userDetailsModal.classList.add('flex');
    lucide.createIcons();
}

function closeUserDetailsModal() {
    userDetailsModal.classList.add('hidden');
    userDetailsModal.classList.remove('flex');
}

window.addEventListener('beforeunload', () => {
  if (realtimeUnsubscribe) realtimeUnsubscribe();
});

lucide.createIcons();
