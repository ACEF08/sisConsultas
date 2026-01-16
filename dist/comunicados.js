
import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js';
import { collection, addDoc, serverTimestamp, query, onSnapshot, orderBy, deleteDoc, doc } from 'https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js';

document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const userInfoContainer = document.getElementById('admin-user-info');
    const logoutButton = document.getElementById('logout-button');
    const comunicadoForm = document.getElementById('comunicado-form');
    const comunicadosList = document.getElementById('comunicados-list');

    let currentUser = null;

    // --- Authentication ---
    onAuthStateChanged(auth, user => {
        if (user) {
            currentUser = user;
            setupUI(user);
            setupEventListeners();
            loadComunicados();
        } else {
            window.location.href = 'admin-login.html';
        }
    });

    // --- Setup ---
    function setupUI(user) {
        const userInitial = (user.displayName || user.email.split('@')[0]).charAt(0).toUpperCase();
        userInfoContainer.innerHTML = `
            <div class="h-10 w-10 flex-shrink-0 flex items-center justify-center rounded-full bg-sidebar-accent text-sidebar-accent-foreground font-bold">${userInitial}</div>
            <div class="min-w-0 flex-1">
                <p class="font-medium truncate">${user.displayName || user.email.split('@')[0]}</p>
                <p class="text-xs text-sidebar-muted truncate">${user.email}</p>
            </div>`;
    }

    function setupEventListeners() {
        logoutButton.addEventListener('click', () => signOut(auth).catch(console.error));
        comunicadoForm.addEventListener('submit', handleFormSubmit);
        comunicadosList.addEventListener('click', handleDeleteClick);
    }

    // --- RF-024: Send Announcement ---
    async function handleFormSubmit(e) {
        e.preventDefault();
        const titulo = document.getElementById('titulo').value;
        const mensaje = document.getElementById('mensaje').value;
        const tipo = document.getElementById('tipo').value;

        if (!titulo || !mensaje) {
            alert('El título y el mensaje no pueden estar vacíos.');
            return;
        }

        try {
            await addDoc(collection(db, 'comunicados'), {
                titulo,
                mensaje,
                tipo,
                remitente: currentUser.email,
                fechaCreacion: serverTimestamp()
            });
            alert('Comunicado enviado con éxito.');
            comunicadoForm.reset();
        } catch (error) {
            console.error("Error al enviar comunicado:", error);
            alert('Hubo un error al enviar el comunicado. Inténtelo de nuevo.');
        }
    }

    // --- RF-025: Load and Display Announcements ---
    function loadComunicados() {
        const q = query(collection(db, 'comunicados'), orderBy('fechaCreacion', 'desc'));

        onSnapshot(q, (snapshot) => {
            if (snapshot.empty) {
                comunicadosList.innerHTML = '<p class="text-muted-foreground">No hay comunicados para mostrar.</p>';
                return;
            }

            comunicadosList.innerHTML = snapshot.docs.map(doc => renderComunicado(doc.id, doc.data())).join('');
            lucide.createIcons(); // Re-render icons after updating the DOM
        }, (error) => {
            console.error("Error al cargar comunicados: ", error);
            comunicadosList.innerHTML = '<p class="text-red-500">Error al cargar los comunicados.</p>';
        });
    }

    function renderComunicado(id, data) {
        const fecha = data.fechaCreacion ? new Date(data.fechaCreacion.seconds * 1000).toLocaleString('es-PE') : 'Fecha no disponible';
        const typeClasses = {
            informativo: 'border-blue-500',
            urgente: 'border-yellow-500',
            critico: 'border-red-500'
        };
        
        return `
            <div class="p-4 rounded-lg bg-card-foreground/5 border-l-4 ${typeClasses[data.tipo] || 'border-gray-500'}">
                <div class="flex justify-between items-start">
                    <div>
                        <h3 class="font-bold">${data.titulo}</h3>
                        <p class="text-sm text-muted-foreground mt-1">${data.mensaje}</p>
                    </div>
                    <button data-id="${id}" class="text-muted-foreground hover:text-red-500 p-1"><i data-lucide="trash-2" class="h-4 w-4"></i></button>
                </div>
                <p class="text-xs text-muted-foreground/80 mt-2">Enviado por: ${data.remitente} - ${fecha}</p>
            </div>
        `;
    }

    // --- Delete Announcement ---
    async function handleDeleteClick(e) {
        const deleteButton = e.target.closest('button[data-id]');
        if (!deleteButton) return;

        const docId = deleteButton.dataset.id;
        if (confirm('¿Está seguro de que desea eliminar este comunicado?')) {
            try {
                await deleteDoc(doc(db, 'comunicados', docId));
                alert('Comunicado eliminado.');
            } catch (error) {
                console.error("Error al eliminar comunicado: ", error);
                alert('No se pudo eliminar el comunicado.');
            }
        }
    }
});
