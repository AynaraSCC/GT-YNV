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
5. Tickets dorados, numeración 000–999, preferencias y condiciones.

## Fotos y videos

**Galería "¿Qué celebrarías tú?"** (fotos en blanco y negro): `assets/images/img1.jpg` boda, `img2.jpg` quince, `img3.jpg` grado.

**Carrusel "Lo hacemos parte de tu historia"**: 9 espacios (`quince-1..3`, `boda-1..3`, `grado-1..3`). Cada espacio puede ser:
- un **video** en `assets/video/` → por ejemplo `assets/video/boda-1.mp4`, o
- una **foto** en `assets/images/` → por ejemplo `assets/images/boda-2.jpg`.

Si un espacio tiene video y foto, se usa el video. Los espacios vacíos se saltan solos. Las fotos se ven en blanco y negro y los videos a color. Los navegadores no dejan arrancar con sonido: el sonido se activa con el primer toque (botón "Toca para escuchar", flechas o pestañas). Formato vertical 576×934 como el video de boda, MP4, menos de 5 MB, máximo 30 s.

### Ideas para las fotos (si se generan con IA)
- **Quince:** quinceañera con vestido lila de princesa, salón de gala en tonos marfil y dorado, candelabros de cristal, luces cálidas, fondo muy tierno con flores en tonos pastel.
- **Boda:** novios en un salón neutro con arco de flores blancas y rubor, velas, candelabros, ambiente de noche elegante.
- **Grado:** graduada/o con toga y birrete celebrando en un salón dorado de noche, mesas con centros de flores altas.

## Venta de tickets
La cuadrícula, el formulario y el pago con Wompi ya están construidos. Para activarlos sigue **[CONFIGURAR-VENTA.md](CONFIGURAR-VENTA.md)**. Mientras `js/config.js` esté vacío, la página queda en modo demostración.

## Video de la portada
`assets/video/yenova-solorzano.mp4` (con imagen de respaldo `yenova-solorzano.jpg`). Para cambiarlo, reemplaza esos archivos con los mismos nombres.
