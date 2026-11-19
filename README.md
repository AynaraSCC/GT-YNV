# Golden Ticket — YeNoVa Cupcakes

Landing page de una sola página (negro y dorado) para la rifa Golden Ticket. Pensada para compartirse como enlace en redes sociales.

## Verla
Abre `index.html` con Live Server (Visual Studio Code) o súbela a un hosting estático (GitHub Pages, Netlify…).
El salón 3D usa módulos de JavaScript, así que **no funciona abriendo el archivo con doble clic**: necesita un servidor.

## Secciones
1. Portada — "Tu historia merece una noche de lujo, ensueño y fantasía."
2. El premio — tres opciones: **Tus quince**, **Tu boda soñada**, **El triunfo de tu grado universitario**, con carrusel de fotos.
3. Inspiración — galería de tres fotos.
4. **Salón 3D** — las puertas se abren y la cámara entra a un salón de gala en tonos marfil, champaña y dorado (`js/salon.js`, con Three.js desde CDN).
5. Tiquetes dorados, numeración 001–1000, preferencias y condiciones.

## Fotografías
Guárdalas en `assets/images/` con estos nombres exactos (formato vertical u horizontal, mínimo 1200 px):

| Carrusel "Lo hacemos parte de tu historia" | Galería |
|---|---|
| `quince-1.jpg`, `quince-2.jpg`, `quince-3.jpg` | `img1.jpg` — boda |
| `boda-1.jpg`, `boda-2.jpg`, `boda-3.jpg` | `img2.jpg` — quince años |
| `grado-1.jpg`, `grado-2.jpg`, `grado-3.jpg` | `img3.jpg` — grado universitario |

Mientras una foto no exista, el carrusel muestra un fondo elegante con el nombre de la celebración (no se ve roto).

### Ideas para las fotos (si se generan con IA)
- **Quince:** quinceañera con vestido lila de princesa, salón de gala en tonos marfil y dorado, candelabros de cristal, luces cálidas, fondo muy tierno con flores en tonos pastel.
- **Boda:** novios en un salón neutro con arco de flores blancas y rubor, velas, candelabros, ambiente de noche elegante.
- **Grado:** graduada/o con toga y birrete celebrando en un salón dorado de noche, mesas con centros de flores altas.

## Alcance
La cuadrícula de números es visual: no reserva, vende ni guarda datos. El botón de pago está deshabilitado hasta que la rifa esté autorizada.
