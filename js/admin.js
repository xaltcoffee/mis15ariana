// Panel administrador: inicio de sesión con Firebase Auth y lectura de las
// confirmaciones desde Firestore. Las reglas de seguridad solo permiten leer
// la colección "rsvp" a la cuenta administradora autenticada.
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
  confirmaciones: document.querySelector("#stat-confirmaciones"),
  personas: document.querySelector("#stat-personas"),
  solo: document.querySelector("#stat-solo"),
  acompanado: document.querySelector("#stat-acompanado"),
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

function formatDate(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("es", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
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

function renderRows(rows) {
  tableBody.innerHTML = rows
    .map((row) => {
      const accompanied = row.modalidad === "acompanado";
      return `<tr>
        <td>${escapeHtml(row.nombreCompleto)}</td>
        <td>${escapeHtml(row.telefono)}</td>
        <td>${accompanied ? "Acompañado(a)" : "Solo(a)"}</td>
        <td>${escapeHtml(row.acompanante) || "—"}</td>
        <td>${escapeHtml(row.totalPersonas)}</td>
        <td>${escapeHtml(formatDate(row.creadoEn))}</td>
      </tr>`;
    })
    .join("");
}

async function loadConfirmations() {
  const snapshot = await getDocs(collection(db, "rsvp"));
  const rows = [];
  let totalPersonas = 0;
  let solo = 0;
  let acompanado = 0;

  snapshot.forEach((document) => {
    const data = document.data();
    const personas = Number(data.totalPersonas) || 1;
    totalPersonas += personas;
    if (data.modalidad === "acompanado") acompanado += 1;
    else solo += 1;
    rows.push({
      nombreCompleto: data.nombreCompleto,
      telefono: data.telefono,
      modalidad: data.modalidad,
      acompanante: data.acompanante,
      totalPersonas: personas,
      creadoEn: data.creadoEn ? data.creadoEn.toDate() : null,
    });
  });

  rows.sort((a, b) => (b.creadoEn ? b.creadoEn.getTime() : 0) - (a.creadoEn ? a.creadoEn.getTime() : 0));

  stats.confirmaciones.textContent = String(rows.length);
  stats.personas.textContent = String(totalPersonas);
  stats.solo.textContent = String(solo);
  stats.acompanado.textContent = String(acompanado);

  renderRows(rows);
  emptyMessage.hidden = rows.length > 0;
}

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

  if (!authenticated) return;
  try {
    await loadConfirmations();
  } catch (error) {
    // Diagnóstico: mostramos el código real para saber si es permiso, red o reglas.
    const code = (error && error.code) || "desconocido";
    console.error("[ADMIN] Falló la lectura de Firestore:", code, error && error.message);
    const detail =
      code === "permission-denied"
        ? "Las reglas de Firestore no autorizan tu correo. Revisa firestore.rules y publícalas."
        : code === "unavailable"
          ? "Sin conexión con Firestore. Revisa tu red."
          : "Revisa la consola del navegador para más detalle.";
    tableBody.innerHTML = "";
    emptyMessage.textContent = `No pudimos cargar las confirmaciones. (Código: ${code}) ${detail}`;
    emptyMessage.hidden = false;
  }
});
