
import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";
import { collection, onSnapshot, query, doc, updateDoc, getDoc } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {
    const adminName = document.getElementById('admin-name');
    const adminEmail = document.getElementById('admin-email');
    const adminLogoutButton = document.getElementById('admin-logout-button');
    const userProfileDiv = document.getElementById('user-profile').querySelector('div:first-child');
    const totalQueriesEl = document.getElementById('total-queries');
    const pendingQueriesEl = document.getElementById('pending-queries');
    const assignedQueriesEl = document.getElementById('assigned-queries');
    const attendedQueriesEl = document.getElementById('attended-queries');
    const tabNewSystem = document.getElementById('tab-new-system');
    const tabOldSystem = document.getElementById('tab-old-system');
    const contentNewSystem = document.getElementById('content-new-system');
    const contentOldSystem = document.getElementById('content-old-system');
    const newQueryNotification = document.getElementById('new-query-notification');
    const notificationSound = document.getElementById('notification-sound');
    const modalPlaceholder = document.getElementById('modal-placeholder');
    const toastContainer = document.getElementById("toast-container");

    let allQueries = [];
    const chemists = [
        { id: 'quimico1@dirisls.gob.pe', name: 'Juan Pérez' },
        { id: 'quimico2@dirisls.gob.pe', name: 'Ana Gómez' },
        { id: 'quimico3@dirisls.gob.pe', name: 'Luis Torres' },
    ];

    function showToast(message, type = "success") {
        const toast = document.createElement("div");
        toast.className = `flex items-center w-full max-w-xs p-4 mb-4 text-gray-500 bg-white rounded-lg shadow dark:text-gray-400 dark:bg-gray-800 ${
            type === "error" ? "border-red-500" : "border-green-500"
        }`;
        toast.innerHTML = `
            <div class="ml-3 text-sm font-normal">${message}</div>
            <button type="button" class="ml-auto -mx-1.5 -my-1.5 bg-white text-gray-400 hover:text-gray-900 rounded-lg focus:ring-2 focus:ring-gray-300 p-1.5 hover:bg-gray-100 inline-flex h-8 w-8 dark:text-gray-500 dark:hover:text-white dark:bg-gray-800 dark:hover:bg-gray-700">
                <span class="sr-only">Close</span>
                <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path></svg>
            </button>
        `;
        toastContainer.appendChild(toast);

        toast.querySelector("button").onclick = () => toast.remove();
        setTimeout(() => toast.remove(), 5000);
    }

    onAuthStateChanged(auth, (user) => {
        if (user) {
            adminName.textContent = user.displayName || user.email.split('@')[0];
            adminEmail.textContent = user.email;
            userProfileDiv.textContent = (user.displayName || user.email.charAt(0)).toUpperCase();
            
            initializeAdminPanel();
        } else {
            window.location.href = 'admin-login.html';
        }
    });

    function initializeAdminPanel() {
        loadQueries();
        setupTabs();
        setupEventListeners();
    }

    function setupEventListeners() {
        adminLogoutButton.addEventListener('click', () => {
            signOut(auth).catch(err => showToast("Error al cerrar sesión.", "error"));
        });

        contentNewSystem.addEventListener('click', (e) => {
            if (e.target.closest('button[data-query-id]')) {
                const queryId = e.target.closest('button[data-query-id]').dataset.queryId;
                showManagementModal(queryId);
            }
        });
    }

    function setupTabs() {
         tabNewSystem.addEventListener('click', () => {
            tabNewSystem.classList.add('active');
            tabOldSystem.classList.remove('active');
            contentNewSystem.classList.remove('hidden');
            contentOldSystem.classList.add('hidden');
        });

        tabOldSystem.addEventListener('click', () => {
            tabOldSystem.classList.add('active');
            tabNewSystem.classList.remove('active');
            contentOldSystem.classList.remove('hidden');
            contentNewSystem.classList.add('hidden');
            contentOldSystem.innerHTML = `<p>El historial de consultas del sistema antiguo aún no ha sido migrado.</p>`;
        });
    }

    function loadQueries() {
        const q = query(collection(db, "queries"));
        let isInitialLoad = true;

        onSnapshot(q, (snapshot) => {
            const previousQueryCount = allQueries.length;
            allQueries = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            allQueries.sort((a, b) => (b.fechaCreacion?.seconds ?? 0) - (a.fechaCreacion?.seconds ?? 0));

            updateStatistics(allQueries);
            renderQueriesTable(allQueries);

            if (!isInitialLoad && allQueries.length > previousQueryCount) {
                playNotificationSound();
                showNotificationDot();
            }
            isInitialLoad = false;
        }, (error) => {
            console.error("Error loading queries:", error);
            showToast("Error al cargar las consultas.", "error");
        });
    }

    function updateStatistics(queries) {
        totalQueriesEl.textContent = queries.length;
        pendingQueriesEl.textContent = queries.filter(q => q.status === 'Pendiente').length;
        assignedQueriesEl.textContent = queries.filter(q => q.status === 'Asignado').length;
        attendedQueriesEl.textContent = queries.filter(q => q.status === 'Atendido').length;
    }

    function renderQueriesTable(queries) {
        if (queries.length === 0) {
            contentNewSystem.innerHTML = `<p>No hay consultas registradas.</p>`;
            return;
        }

        const tableRows = queries.map(q => {
            const fecha = q.fechaCreacion ? new Date(q.fechaCreacion.seconds * 1000).toLocaleDateString('es-PE') : 'N/A';
            const statusClasses = {
                'Pendiente': "status-pill-red",
                'Asignado': "status-pill-yellow",
                'Atendido': "status-pill-green",
            }[q.status] || "status-pill-gray";
            return `
                <tr class="border-b">
                    <td class="table-cell font-medium">${q.numeroConsulta}</td>
                    <td class="table-cell">${q.userId}</td>
                    <td class="table-cell">${q.tema}</td>
                    <td class="table-cell"><span class="${statusClasses}">${q.status}</span></td>
                    <td class="table-cell">${q.assignedTo || 'N/A'}</td>
                    <td class="table-cell">${fecha}</td>
                    <td class="table-cell text-right">
                        <button class="btn btn-sm btn-outline-secondary" data-query-id="${q.id}">Gestionar</button>
                    </td>
                </tr>
            `;
        }).join('');

        contentNewSystem.innerHTML = `
            <div class="overflow-x-auto">
                <table class="w-full text-sm">
                    <thead>
                        <tr class="border-b">
                            <th class="table-header">Expediente</th>
                            <th class="table-header">DNI Usuario</th>
                            <th class="table-header">Tema</th>
                            <th class="table-header">Estado</th>
                            <th class="table-header">Asignado a</th>
                            <th class="table-header">Fecha</th>
                            <th class="table-header text-right">Acciones</th>
                        </tr>
                    </thead>
                    <tbody class="bg-white">${tableRows}</tbody>
                </table>
            </div>
        `;
    }

    function showManagementModal(queryId) {
        const query = allQueries.find(q => q.id === queryId);
        if (!query) return;

        const chemistOptions = chemists.map(c => `<option value="${c.name}" ${query.assignedTo === c.name ? 'selected' : ''}>${c.name}</option>`).join('');

        const modalHTML = `
            <div id="management-modal" class="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
                <div class="bg-white rounded-lg shadow-2xl p-6 w-full max-w-2xl max-h-full overflow-y-auto">
                    <div class="flex justify-between items-center border-b pb-3">
                        <h3 class="text-xl font-bold font-headline">Gestionar Consulta</h3>
                        <button id="close-modal" class="p-1 rounded-full hover:bg-gray-200"><i data-lucide="x"></i></button>
                    </div>
                    <div class="mt-4 grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                        <div class="space-y-3">
                           <p><strong>Expediente:</strong> ${query.numeroConsulta}</p>
                           <p><strong>Usuario DNI:</strong> ${query.userId}</p>
                           <p><strong>Establecimiento:</strong> ${query.nombreEstablecimiento}</p>
                           <p><strong>Email:</strong> ${query.emailEstablecimiento}</p>
                           <p><strong>Tema:</strong> ${query.tema}</p>
                           ${query.detalle ? `<p><strong>Descripción:</strong> ${query.detalle}</p>` : ''}
                        </div>
                        <div class="space-y-4">
                            <div>
                                <label class="font-semibold">Asignar Consulta (RF-014)</label>
                                <select id="chemist-select" class="input-form-admin w-full mt-1" ${query.status !== 'Pendiente' ? 'disabled' : ''}> 
                                    <option value="" disabled ${!query.assignedTo ? 'selected' : ''}>Seleccionar químico...</option>
                                    ${chemistOptions}
                                </select>
                                <button id="assign-btn" class="btn btn-secondary w-full mt-2" ${query.status !== 'Pendiente' ? 'disabled' : ''}>Asignar</button>
                            </div>
                            <div class="border-t"></div>
                            <div>
                                <label class="font-semibold">Atender Consulta (RF-015)</label>
                                <textarea id="observation-input" class="input-form-admin w-full mt-1" rows="4" placeholder="Añada una observación final..." ${query.status === 'Atendido' ? 'disabled' : ''}>${query.observacionFinal || ''}</textarea>
                                <button id="attend-btn" class="btn btn-primary w-full mt-2" ${query.status === 'Atendido' ? 'disabled' : ''}>Marcar como Atendido</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        modalPlaceholder.innerHTML = modalHTML;
        lucide.createIcons();

        const modal = document.getElementById('management-modal');
        modal.querySelector('#close-modal').addEventListener('click', () => modal.remove());
        modal.querySelector('#assign-btn').addEventListener('click', () => assignQuery(queryId));
        modal.querySelector('#attend-btn').addEventListener('click', () => attendQuery(queryId));
    }

    async function assignQuery(queryId) {
        const selectedChemist = document.getElementById('chemist-select').value;
        if (!selectedChemist) {
            showToast("Por favor, seleccione un químico para asignar la consulta.", "error");
            return;
        }

        try {
            const queryRef = doc(db, "queries", queryId);
            await updateDoc(queryRef, {
                status: 'Asignado',
                assignedTo: selectedChemist
            });
            showToast(`Consulta asignada a ${selectedChemist}.`);
            playNotificationSound();
            document.getElementById('management-modal').remove();
        } catch (error) {
            console.error("Error al asignar la consulta:", error);
            showToast("Hubo un error al asignar la consulta.", "error");
        }
    }

    async function attendQuery(queryId) {
        const observation = document.getElementById('observation-input').value;
        if (!observation) {
            showToast("Por favor, añada una observación final para atender la consulta.", "error");
            return;
        }

        try {
            const queryRef = doc(db, "queries", queryId);
            await updateDoc(queryRef, {
                status: 'Atendido',
                observacionFinal: observation
            });
            showToast("La consulta ha sido marcada como Atendida.");
            document.getElementById('management-modal').remove();
        } catch (error) {
            console.error("Error al atender la consulta:", error);
            showToast("Hubo un error al atender la consulta.", "error");
        }
    }

    function playNotificationSound() {
        notificationSound.play().catch(e => console.warn("El audio no pudo reproducirse automáticamente."));
    }

    function showNotificationDot() {
        newQueryNotification.classList.remove('hidden');
    }

});
