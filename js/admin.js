// Panel administrador: inicio de sesión con Firebase Auth y gestión de las
// confirmaciones en Firestore. La edición se hace en la propia fila de la tabla
// (sin modales). Las reglas autorizan leer, actualizar y eliminar la colección
// "rsvp" únicamente a la cuenta administradora.
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";
import {
  getFirestore,
  collection,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  writeBatch,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const loginSection = document.querySelector("#admin-login");
const dashboardSection = document.querySelector("#admin-dashboard");
const logoutButton = document.querySelector("#admin-logout");
const loginForm = document.querySelector("#admin-login-form");
const loginFeedback = document.querySelector("#admin-login-feedback");
const loginSubmit = document.querySelector("#admin-login-submit");
const tableBody = document.querySelector("#admin-table-body");
const emptyMessage = document.querySelector("#admin-empty");
const stats = {
  respuestas: document.querySelector("#stat-respuestas"),
  asisten: document.querySelector("#stat-asisten"),
  noAsisten: document.querySelector("#stat-no-asisten"),
  personas: document.querySelector("#stat-personas"),
};

const AUTH_ERRORS = {
  "auth/invalid-email": "El correo no tiene un formato válido.",
  "auth/user-not-found": "No existe una cuenta con ese correo.",
  "auth/wrong-password": "La contraseña es incorrecta.",
  "auth/invalid-credential": "Correo o contraseña incorrectos.",
  "auth/too-many-requests": "Demasiados intentos. Espera un momento e inténtalo de nuevo.",
  "auth/network-request-failed": "Sin conexión. Revisa tu red e inténtalo de nuevo.",
  "auth/operation-not-allowed": "El inicio de sesión con correo/contraseña no está habilitado en Firebase.",
  "auth/configuration-not-found": "Falta habilitar el proveedor de correo/contraseña en Firebase.",
  "auth/api-key-not-valid": "La API key de Firebase no es válida.",
  "auth/invalid-api-key": "La API key de Firebase no es válida.",
  "auth/app-not-authorized": "Esta API key no está autorizada para este dominio.",
  "auth/unauthorized-domain": "Este dominio no está autorizado en Firebase Authentication.",
};

// Caché de los registros, indexados por el ID del documento (= teléfono).
const records = new Map();
let currentRows = [];
// Estado de edición inline: fila en edición y fila pendiente de eliminar.
let editingId = null;
let confirmDeleteId = null;

const digitsOnly = (value) => String(value || "").replace(/\D/g, "");

function formatDate(value) {
  if (!value) return "—";
  const date = typeof value.toDate === "function" ? value.toDate() : value;
  return new Intl.DateTimeFormat("es", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function escapeHtml(value) {
  return String(value == null ? "" : value).replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[ch]));
}

function describeFirestoreError(code) {
  if (code === "permission-denied") {
    return "Las reglas de Firestore no autorizan tu correo. Revisa firestore.rules y publícalas.";
  }
  if (code === "unavailable") return "Sin conexión con Firestore. Revisa tu red.";
  return "Revisa la consola del navegador para más detalle.";
}

// "si" / "no" son los valores actuales del formulario. Los registros anteriores
// a la eliminación de la opción de acompañante usaban "solo" / "acompanado".
const isAttending = (modalidad) => modalidad !== "no";
const modalidadLabel = (modalidad) => (isAttending(modalidad) ? "Asistirá" : "No asistirá");

/* ------------------------------------------------------------------ */
/* Renderizado de filas                                                */
/* ------------------------------------------------------------------ */

function renderViewRow(row) {
  const id = escapeHtml(row.id);
  return `<tr data-id="${id}">
    <td>${escapeHtml(row.nombreCompleto)}</td>
    <td>${escapeHtml(row.telefono)}</td>
    <td>${modalidadLabel(row.modalidad)}</td>
    <td>${escapeHtml(row.totalPersonas)}</td>
    <td>${escapeHtml(formatDate(row.creadoEn))}</td>
    <td>
      <div class="admin-actions">
        <button type="button" class="admin-action" data-action="edit" data-id="${id}">Editar</button>
        <button type="button" class="admin-action is-danger" data-action="delete" data-id="${id}">Eliminar</button>
      </div>
    </td>
  </tr>`;
}

function renderEditRow(row) {
  const attends = isAttending(row.modalidad);
  return `<tr data-id="${escapeHtml(row.id)}" class="is-editing">
    <td><input class="admin-input" data-edit="nombreCompleto" type="text" maxlength="80" value="${escapeHtml(row.nombreCompleto)}" /></td>
    <td><input class="admin-input" data-edit="telefono" type="tel" inputmode="tel" maxlength="25" value="${escapeHtml(row.telefono)}" /></td>
    <td>
      <select class="admin-select" data-edit="modalidad">
        <option value="si"${attends ? " selected" : ""}>Asistirá</option>
        <option value="no"${attends ? "" : " selected"}>No asistirá</option>
      </select>
    </td>
    <td data-edit-personas>${attends ? "1" : "0"}</td>
    <td>${escapeHtml(formatDate(row.creadoEn))}</td>
    <td>
      <div class="admin-actions">
        <button type="button" class="admin-action is-save" data-action="save" data-id="${escapeHtml(row.id)}">Guardar</button>
        <button type="button" class="admin-action" data-action="cancel">Cancelar</button>
      </div>
      <span class="admin-row-feedback" data-feedback role="status" aria-live="polite"></span>
    </td>
  </tr>`;
}

function renderConfirmRow(row) {
  return `<tr data-id="${escapeHtml(row.id)}" class="is-confirming">
    <td>${escapeHtml(row.nombreCompleto)}</td>
    <td>${escapeHtml(row.telefono)}</td>
    <td>${modalidadLabel(row.modalidad)}</td>
    <td>${escapeHtml(row.totalPersonas)}</td>
    <td>${escapeHtml(formatDate(row.creadoEn))}</td>
    <td>
      <div class="admin-actions">
        <span class="admin-confirm-text">¿Eliminar?</span>
        <button type="button" class="admin-action is-danger" data-action="confirm-delete" data-id="${escapeHtml(row.id)}">Sí</button>
        <button type="button" class="admin-action" data-action="cancel-delete">No</button>
      </div>
      <span class="admin-row-feedback" data-feedback role="status" aria-live="polite"></span>
    </td>
  </tr>`;
}

function renderRows(rows) {
  tableBody.innerHTML = rows
    .map((row) => {
      if (row.id === editingId) return renderEditRow(row);
      if (row.id === confirmDeleteId) return renderConfirmRow(row);
      return renderViewRow(row);
    })
    .join("");
}

function rerender() {
  renderRows(currentRows);
}

/* ------------------------------------------------------------------ */
/* Carga de datos                                                      */
/* ------------------------------------------------------------------ */

async function loadConfirmations() {
  const snapshot = await getDocs(collection(db, "rsvp"));
  const rows = [];
  let totalPersonas = 0;
  let asisten = 0;
  let noAsisten = 0;

  records.clear();

  snapshot.forEach((document) => {
    const data = document.data();
    const asiste = isAttending(data.modalidad);
    const personas = Number(data.totalPersonas) || (asiste ? 1 : 0);
    totalPersonas += personas;
    if (asiste) asisten += 1;
    else noAsisten += 1;

    const row = {
      id: document.id,
      nombreCompleto: data.nombreCompleto,
      telefono: data.telefono,
      modalidad: data.modalidad,
      totalPersonas: personas,
      // Conservamos el Timestamp original para poder reutilizarlo al reindexar.
      creadoEn: data.creadoEn || null,
    };
    records.set(row.id, row);
    rows.push(row);
  });

  const millis = (value) => (value && typeof value.toMillis === "function" ? value.toMillis() : 0);
  rows.sort((a, b) => millis(b.creadoEn) - millis(a.creadoEn));

  stats.respuestas.textContent = String(rows.length);
  stats.asisten.textContent = String(asisten);
  stats.noAsisten.textContent = String(noAsisten);
  stats.personas.textContent = String(totalPersonas);

  currentRows = rows;
  rerender();
  emptyMessage.textContent = "Aún no hay confirmaciones registradas.";
  emptyMessage.hidden = rows.length > 0;
}

async function refresh() {
  try {
    await loadConfirmations();
  } catch (error) {
    const code = (error && error.code) || "desconocido";
    console.error("[ADMIN] Falló la lectura de Firestore:", code, error && error.message);
    tableBody.innerHTML = "";
    emptyMessage.textContent = `No pudimos cargar las confirmaciones. (Código: ${code}) ${describeFirestoreError(code)}`;
    emptyMessage.hidden = false;
  }
}

/* ------------------------------------------------------------------ */
/* Acciones de la fila                                                 */
/* ------------------------------------------------------------------ */

function startEdit(id) {
  editingId = id;
  confirmDeleteId = null;
  rerender();
  const input = tableBody.querySelector(`tr.is-editing [data-edit="nombreCompleto"]`);
  if (input) input.focus();
}

function cancelEdit() {
  editingId = null;
  rerender();
}

function startDelete(id) {
  confirmDeleteId = id;
  editingId = null;
  rerender();
}

function cancelDelete() {
  confirmDeleteId = null;
  rerender();
}

async function saveEdit(id) {
  const original = records.get(id);
  const tr = tableBody.querySelector(`tr.is-editing`);
  if (!original || !tr) {
    editingId = null;
    rerender();
    return;
  }

  const feedback = tr.querySelector("[data-feedback]");
  const nombreCompleto = tr.querySelector('[data-edit="nombreCompleto"]').value.trim();
  const telefono = tr.querySelector('[data-edit="telefono"]').value.trim();
  const phoneId = digitsOnly(telefono);
  const modalidad = tr.querySelector('[data-edit="modalidad"]').value;

  if (nombreCompleto.length < 3 || nombreCompleto.length > 80) {
    feedback.textContent = "El nombre debe tener entre 3 y 80 caracteres.";
    return;
  }
  if (phoneId.length < 7 || phoneId.length > 15) {
    feedback.textContent = "El teléfono debe tener entre 7 y 15 dígitos.";
    return;
  }

  const payload = {
    nombreCompleto,
    telefono,
    telefonoId: phoneId,
    modalidad,
    acompanante: null,
    totalPersonas: modalidad === "si" ? 1 : 0,
  };

  tr.querySelector('[data-action="save"]').disabled = true;
  try {
    if (phoneId === id) {
      // Mismo teléfono: actualizamos el documento existente.
      await updateDoc(doc(db, "rsvp", id), payload);
    } else {
      // El teléfono cambió y es el ID del documento: reindexamos en una sola
      // operación atómica para conservar el anti-duplicados.
      const batch = writeBatch(db);
      batch.set(doc(db, "rsvp", phoneId), {
        ...payload,
        creadoEn: original.creadoEn || serverTimestamp(),
      });
      batch.delete(doc(db, "rsvp", id));
      await batch.commit();
    }
    editingId = null;
    await refresh();
  } catch (error) {
    const code = (error && error.code) || "desconocido";
    console.error("[ADMIN] Falló la edición en Firestore:", code, error && error.message);
    feedback.textContent =
      code === "permission-denied"
        ? `No se pudo guardar. Si cambiaste el teléfono, puede que ya exista otro registro con ese número. (${code})`
        : `No pudimos guardar. ${describeFirestoreError(code)} (${code})`;
    const saveButton = tr.querySelector('[data-action="save"]');
    if (saveButton) saveButton.disabled = false;
  }
}

async function confirmDelete(id) {
  const tr = tableBody.querySelector(`tr.is-confirming`);
  const feedback = tr ? tr.querySelector("[data-feedback]") : null;
  const button = tr ? tr.querySelector('[data-action="confirm-delete"]') : null;
  if (button) button.disabled = true;
  try {
    await deleteDoc(doc(db, "rsvp", id));
    confirmDeleteId = null;
    await refresh();
  } catch (error) {
    const code = (error && error.code) || "desconocido";
    console.error("[ADMIN] Falló la eliminación en Firestore:", code, error && error.message);
    if (feedback) feedback.textContent = `No pudimos eliminar. ${describeFirestoreError(code)} (${code})`;
    if (button) button.disabled = false;
  }
}

/* ------------------------------------------------------------------ */
/* Eventos                                                             */
/* ------------------------------------------------------------------ */

tableBody.addEventListener("click", (event) => {
  const button = event.target.closest("[data-action]");
  if (!button) return;
  const id = button.dataset.id;
  switch (button.dataset.action) {
    case "edit":
      startEdit(id);
      break;
    case "cancel":
      cancelEdit();
      break;
    case "delete":
      startDelete(id);
      break;
    case "cancel-delete":
      cancelDelete();
      break;
    case "save":
      saveEdit(id);
      break;
    case "confirm-delete":
      confirmDelete(id);
      break;
    default:
      break;
  }
});

// Recalcular las personas al cambiar la asistencia en la fila en edición.
tableBody.addEventListener("change", (event) => {
  const select = event.target.closest('[data-edit="modalidad"]');
  if (!select) return;
  const tr = select.closest("tr");
  tr.querySelector("[data-edit-personas]").textContent = select.value === "si" ? "1" : "0";
});

// Cancelar la edición o la eliminación pendiente con la tecla Escape.
document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  if (editingId) cancelEdit();
  if (confirmDeleteId) cancelDelete();
});

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  loginFeedback.textContent = "";
  loginSubmit.disabled = true;
  try {
    await signInWithEmailAndPassword(
      auth,
      document.querySelector("#admin-email").value.trim(),
      document.querySelector("#admin-password").value
    );
  } catch (error) {
    loginFeedback.textContent =
      AUTH_ERRORS[error.code] || "No pudimos iniciar sesión. Inténtalo de nuevo.";
  } finally {
    loginSubmit.disabled = false;
  }
});

logoutButton.addEventListener("click", () => signOut(auth));

onAuthStateChanged(auth, async (user) => {
  const authenticated = Boolean(user);
  loginSection.hidden = authenticated;
  dashboardSection.hidden = !authenticated;
  logoutButton.hidden = !authenticated;
  loginFeedback.textContent = "";
  if (authenticated) loginForm.reset();

  if (!authenticated) {
    records.clear();
    currentRows = [];
    editingId = null;
    confirmDeleteId = null;
    tableBody.innerHTML = "";
    return;
  }
  await refresh();
});
