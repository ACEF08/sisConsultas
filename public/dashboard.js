// dashboard.js
import { auth, db } from "./firebase-config.js";
import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  serverTimestamp,
  orderBy
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

// Elementos DOM
const userWelcome = document.getElementById("user-welcome");
const logoutButton = document.getElementById("logout-button");
const tabNew = document.getElementById("tab-new");
const tabHistory = document.getElementById("tab-history");
const contentNew = document.getElementById("content-new");
const contentHistory = document.getElementById("content-history");
const historyAccordion = document.getElementById("history-accordion");
const newQueryForm = document.getElementById("new-query-form");
const toastContainer = document.getElementById("toast-container");

let currentUser = null;

// Formatear fecha
function formatDate(timestamp) {
  if (!timestamp) return "Sin fecha";
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  if (isNaN(date.getTime())) return 'Fecha inválida';
  return date.toLocaleDateString("es-PE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// Toast
function showToast(message, type = "success") {
  const toast = document.createElement("div");
  toast.className = `flex items-center w-full max-w-sm p-4 mb-4 text-gray-900 bg-white rounded-lg shadow border ${type === "error" ? "border-red-500" : "border-green-500"}`;
  toast.innerHTML = `
    <div class="ml-3 text-sm font-normal">${message}</div>
    <button type="button" class="ml-auto -mx-1.5 -my-1.5 rounded-lg p-1.5 inline-flex h-8 w-8" onclick="this.parentElement.remove()">
      <span class="sr-only">Close</span>
      <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path></svg>
    </button>
  `;
  toastContainer.appendChild(toast);
  setTimeout(() => toast.remove(), 5000);
}

// Cargar historial
async function loadHistory(dni) {
  historyAccordion.innerHTML = '<p class="text-center text-muted-foreground">Cargando historial...</p>';
  try {
    const q = query(collection(db, "queries"), where("dni", "==", dni), orderBy("fechaCreacion", "desc"));
    const snapshot = await getDocs(q);
    historyAccordion.innerHTML = "";
    if (snapshot.empty) {
      historyAccordion.innerHTML = '<p class="text-center text-muted-foreground">No hay consultas registradas.</p>';
      return;
    }
    snapshot.forEach(doc => {
      const data = doc.data();
      const item = document.createElement("div");
      item.className = "border-b";
      item.innerHTML = `
        <h3>
          <button type="button" class="accordion-toggle flex w-full items-center justify-between py-4 text-left font-medium transition-all hover:underline">
            <div class="flex w-full items-center justify-between pr-4">
                <div class="flex flex-col text-left">
                    <span class="font-semibold">${data.tema || "Sin tema"}</span>
                    <span class="text-sm text-muted-foreground">Expediente: ${data.expediente || "No asignado"}</span>
                </div>
                <div class="flex items-center gap-4">
                    <div class="hidden md:inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold" style="background-color: hsl(var(--primary)/0.1); color: hsl(var(--primary)); border-color: hsl(var(--primary)/0.2);">${data.status || "Pendiente"}</div>
                    <div class="flex items-center gap-2 text-sm text-muted-foreground">
                        <i data-lucide="clock" class="h-4 w-4"></i>
                        <span>${formatDate(data.fechaCreacion)}</span>
                    </div>
                </div>
            </div>
            <i data-lucide="chevron-down" class="h-4 w-4 shrink-0 transition-transform duration-200"></i>
          </button>
        </h3>
        <div class="accordion-content overflow-hidden text-sm hidden">
          <div class="pb-4 pt-0">
            <div class="space-y-4 px-2">
                <div class="md:hidden"><div class="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold" style="background-color: hsl(var(--primary)/0.1); color: hsl(var(--primary)); border-color: hsl(var(--primary)/0.2);">${data.status || "Pendiente"}</div></div>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                    <div class="flex items-start gap-3"><i data-lucide="tag" class="h-5 w-5 text-muted-foreground mt-1"></i><div><p class="font-semibold">Establecimiento</p><p class="text-muted-foreground">${data.nombreEstablecimiento || "-"}</p></div></div>
                    <div class="flex items-start gap-3"><i data-lucide="briefcase" class="h-5 w-5 text-muted-foreground mt-1"></i><div><p class="font-semibold">Cargo</p><p class="text-muted-foreground">${data.cargo || "-"}</p></div></div>
                    ${data.ruc ? `<div class="flex items-start gap-3"><i data-lucide="credit-card" class="h-5 w-5 text-muted-foreground mt-1"></i><div><p class="font-semibold">RUC</p><p class="text-muted-foreground">${data.ruc}</p></div></div>` : ""}
                    ${data.codigoEstablecimiento ? `<div class="flex items-start gap-3"><i data-lucide="hash" class="h-5 w-5 text-muted-foreground mt-1"></i><div><p class="font-semibold">Código</p><p class="text-muted-foreground">${data.codigoEstablecimiento}</p></div></div>` : ""}
                    ${data.descripcion ? `<div class="col-span-full"><p class="font-semibold">Descripción</p><p class="text-muted-foreground whitespace-pre-wrap">${data.descripcion}</p></div>` : ""}
                </div>
            </div>
          </div>
        </div>
      `;
      historyAccordion.appendChild(item);
    });
    lucide.createIcons();
    document.querySelectorAll(".accordion-toggle").forEach(btn => {
      btn.addEventListener("click", () => {
        const content = btn.parentElement.nextElementSibling;
        const icon = btn.querySelector("i:last-child");
        content.classList.toggle("hidden");
        icon.classList.toggle("rotate-180");
      });
    });
  } catch (error) {
    console.error("Error cargando historial:", error);
    showToast("Error al cargar el historial", "error");
  }
}

// Tabs
tabNew.addEventListener("click", () => {
  contentNew.classList.remove("hidden");
  contentHistory.classList.add("hidden");
  tabNew.dataset.state = "active";
  tabHistory.dataset.state = "inactive";
});
tabHistory.addEventListener("click", () => {
  contentHistory.classList.remove("hidden");
  contentNew.classList.add("hidden");
  tabHistory.dataset.state = "active";
  tabNew.dataset.state = "inactive";
});

// Enviar consulta
newQueryForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!currentUser || !currentUser.dni) {
    showToast("No se pudo identificar al usuario. Por favor, recargue la página.", "error");
    return;
  }
  const temaSelect = document.getElementById("tema");
  const cargoSelect = document.getElementById("cargo");
  const queryData = {
    nombreEstablecimiento: document.getElementById("nombre-establecimiento").value.trim().toUpperCase(),
    emailEstablecimiento: document.getElementById("email-establecimiento").value.trim().toUpperCase(),
    ruc: document.getElementById("ruc").value.trim() || null,
    codigoEstablecimiento: document.getElementById("codigo-establecimiento").value.trim().toUpperCase() || null,
    expediente: document.getElementById("expediente").value.trim().toUpperCase(),
    cargo: (cargoSelect.value === "Otros" ? document.getElementById("cargo-otro").value.trim() : cargoSelect.value).toUpperCase(),
    tema: (temaSelect.value === "Otros" ? document.getElementById("tema-otro").value.trim() : temaSelect.value).toUpperCase(),
    descripcion: document.getElementById("detalle").value.trim().toUpperCase() || "",
    userId: currentUser.uid,
    dni: currentUser.dni,
    status: "Pendiente",
    fechaCreacion: serverTimestamp(),
    fechaActualizacion: serverTimestamp(),
    asignadoA: null,
    atendidoPor: null,
    fechaAtencion: null,
    respuesta: "",
  };

  if (!queryData.nombreEstablecimiento || !queryData.emailEstablecimiento || !queryData.expediente || !queryData.cargo || !queryData.tema) {
      showToast("Por favor, complete todos los campos obligatorios (*).", "error");
      return;
  }

  try {
    await addDoc(collection(db, "queries"), queryData);
    showToast("Consulta enviada correctamente. Un administrador la revisará.", "success");
    newQueryForm.reset();
    document.getElementById("detalle-container").classList.add("hidden");
    document.getElementById("detalle").removeAttribute("required");
    document.getElementById("cargo-otro").classList.add("hidden");
    document.getElementById("cargo-otro").removeAttribute("required");
    document.getElementById("tema-otro").classList.add("hidden");
    document.getElementById("tema-otro").removeAttribute("required");
    tabHistory.click();
    loadHistory(currentUser.dni);
  } catch (error) {
    console.error("Error enviando consulta:", error);
    showToast("Error al enviar la consulta. Por favor, inténtelo de nuevo.", "error");
  }
});

// Lógica para mostrar/ocultar campos condicionales
document.getElementById("cargo").addEventListener("change", (e) => {
    const isOtros = e.target.value === "Otros";
    const cargoOtroInput = document.getElementById("cargo-otro");
    cargoOtroInput.classList.toggle("hidden", !isOtros);
    isOtros ? cargoOtroInput.setAttribute("required", "") : cargoOtroInput.removeAttribute("required");
});
document.getElementById("tema").addEventListener("change", (e) => {
    const isOtros = e.target.value === "Otros";
    const temaOtroInput = document.getElementById("tema-otro");
    const detalleContainer = document.getElementById("detalle-container");
    const detalleTextarea = document.getElementById("detalle");
    temaOtroInput.classList.toggle("hidden", !isOtros);
    if (isOtros) {
      temaOtroInput.setAttribute("required", "");
      detalleContainer.classList.remove("hidden");
      detalleTextarea.setAttribute("required", "");
    } else {
      temaOtroInput.removeAttribute("required");
      detalleContainer.classList.add("hidden");
      detalleTextarea.removeAttribute("required");
    }
});

// Auth y manejo de usuario
onAuthStateChanged(auth, async (user) => {
  if (user) {
    const usersRef = collection(db, "users");
    const q = query(usersRef, where("uid", "==", user.uid));
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
      const userDoc = querySnapshot.docs[0];
      currentUser = { uid: user.uid, ...userDoc.data() };
      userWelcome.textContent = `Bienvenido, ${currentUser.nombres || 'Usuario'}.`;
      logoutButton.style.display = 'inline-flex';
      tabHistory.style.display = 'flex';
      loadHistory(currentUser.dni);
      tabHistory.click();
    } else {
      showToast("No se encontraron datos de usuario. Contacte a soporte.", "error");
      window.location.href = "index.html";
    }
  } else {
    currentUser = null;
    window.location.href = "index.html";
  }
});

// Logout
logoutButton.addEventListener("click", () => {
  signOut(auth).catch((err) => { showToast("Error al cerrar sesión", "error"); });
});
