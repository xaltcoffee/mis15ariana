# Ariana · Invitación 3D de 15 años

Invitación digital responsive con ambiente 3D, partículas doradas y un mini-juego de disparos que destruye visualmente la tarjeta de invitación.

## Tecnologías
- HTML5 + CSS
- Tailwind CSS (CDN)
- JavaScript ES Modules
- Three.js (CDN)
- Canvas 2D para el mini-juego
- Firebase: Cloud Firestore (confirmaciones) y Authentication (panel admin)

## Ejecutar localmente
No abras `index.html` directamente porque el navegador puede bloquear módulos ES.
Desde esta carpeta ejecuta:

```bash
python -m http.server 8000
```

Abre http://localhost:8000

También puedes usar la extensión Live Server de VS Code.

## Personalización obligatoria
1. Abre `js/firebase-config.js` y reemplaza los valores con la configuración de tu App Web
   de Firebase (Console → Configuración del proyecto → General → Tus apps → App web).
2. Habilita **Cloud Firestore** (modo producción) y **Authentication → Correo electrónico/Contraseña**.
3. Crea el usuario administrador en Authentication → Users y coloca su correo en `firestore.rules`.
4. Publica las reglas de `firestore.rules` en Firestore Database → Reglas.
5. Revisa el nombre del salón y la dirección en `index.html`.
6. Verifica el enlace de Google Maps; la dirección fue proporcionada como texto y debe confirmarse antes de publicar.

## Publicar
Puedes desplegar esta carpeta como sitio estático en Firebase Hosting, GitHub Pages, Netlify o Vercel.
El backend (Firestore y Auth) vive en Firebase, así que el sitio no necesita un servidor propio.

## Cómo funciona el juego
Inspirado en "Destroy Any Website": un stickman aparece sobre la invitación y puede correr, saltar, girar en el aire y volar. Al disparar rompe la página en bloques que caen con física, hasta liberar la magia al 80%.

- Escritorio: A/D o flechas para correr, Space/W para saltar (toca otra vez para el giro, mantén para volar), S para caer, ratón para apuntar y clic para disparar.
- Móvil/tablet: palanca abajo a la izquierda para mover y saltar/volar, toca la zona derecha para apuntar y mantener disparando.

Todo es local: no captura ni modifica sitios externos ni ejecuta código de terceros.

## Mejoras opcionales
- Añadir música ambiental con botón de activar/desactivar (usar audio con licencia).
- Añadir cuenta regresiva al 21 de noviembre de 2026.
- Sustituir el fondo procedural por fotografía o ilustración original.
