// Confirmación de asistencia (RSVP) con Firebase Firestore.
// El formulario escribe en la colección "rsvp" usando el teléfono (solo dígitos)
// como ID del documento: así un mismo teléfono no puede registrar dos confirmaciones.
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
import {
  getFirestore,
  doc,
  setDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const form = document.querySelector("#rsvp-form");

if (form) {
  const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
  const db = getFirestore(app);

  const nameInput = form.querySelector("#rsvp-name");
  const phoneInput = form.querySelector("#rsvp-phone");
  const companionField = form.querySelector("#rsvp-companion-field");
  const companionInput = form.querySelector("#rsvp-companion");
  const feedback = form.querySelector("#rsvp-feedback");
  const submitButton = form.querySelector("#rsvp-submit");

  const digitsOnly = (value) => String(value || "").replace(/\D/g, "");

  // El campo del acompañante solo se muestra cuando se elige "acompañado".
  form.addEventListener("change", (event) => {
    if (event.target.name !== "modalidad") return;
    const accompanied = event.target.value === "acompanado";
    companionField.hidden = !accompanied;
    companionInput.required = accompanied;
    if (!accompanied) companionInput.value = "";
  });

  function setFeedback(message, type) {
    feedback.textContent = message;
    feedback.dataset.state = type || "";
  }

  function setLoading(loading) {
    submitButton.disabled = loading;
    submitButton.dataset.loading = loading ? "true" : "false";
  }

  function validate() {
    const nombreCompleto = nameInput.value.trim();
    const telefono = phoneInput.value.trim();
    const phoneId = digitsOnly(telefono);
    const modalidad = form.querySelector("input[name='modalidad']:checked").value;
    const acompanante =
      modalidad === "acompanado" ? companionInput.value.trim() : "";

    if (nombreCompleto.length < 3 || nombreCompleto.length > 80) {
      return { error: "Escribe tu nombre completo (mínimo 3 caracteres)." };
    }
    if (phoneId.length < 7 || phoneId.length > 15) {
      return { error: "Escribe un teléfono válido (entre 7 y 15 dígitos)." };
    }
    if (modalidad === "acompanado" && (acompanante.length < 3 || acompanante.length > 80)) {
      return { error: "Escribe el nombre completo de tu acompañante." };
    }

    return {
      data: {
        nombreCompleto,
        telefono,
        telefonoId: phoneId,
        modalidad,
        acompanante: acompanante || null,
        totalPersonas: modalidad === "acompanado" ? 2 : 1,
        creadoEn: serverTimestamp(),
      },
      phoneId,
    };
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    setFeedback("", "");

    const result = validate();
    if (result.error) {
      setFeedback(result.error, "error");
      return;
    }

    setLoading(true);
    try {
      // setDoc sobre un ID existente es un "update", y las reglas solo permiten
      // "create" para el público: por eso un duplicado se rechaza en el servidor.
      await setDoc(doc(db, "rsvp", result.phoneId), result.data);
      form.reset();
      companionField.hidden = true;
      companionInput.required = false;
      setFeedback("¡Gracias! Tu asistencia quedó confirmada. Te esperamos. ✦", "success");
    } catch (error) {
      // Diagnóstico: dejamos el código real visible en la consola del navegador.
      const code = (error && error.code) || "desconocido";
      console.error("[RSVP] Falló el registro en Firestore:", code, error && error.message);

      if (code === "permission-denied") {
        // Mismo código para dos causas distintas: duplicado o reglas/permisos.
        setFeedback(
          `No pudimos registrar tu confirmación. Puede que este teléfono ya esté confirmado ` +
          `o que el servicio aún no esté configurado. (Código: ${code})`,
          "error"
        );
      } else if (code === "unavailable" || code === "deadline-exceeded") {
        setFeedback(
          `No hay conexión con el servicio de confirmaciones. Revisa tu red e inténtalo de nuevo. (Código: ${code})`,
          "error"
        );
      } else {
        setFeedback(`No pudimos guardar tu confirmación. Inténtalo de nuevo. (Código: ${code})`, "error");
      }
    } finally {
      setLoading(false);
    }
  });
}
