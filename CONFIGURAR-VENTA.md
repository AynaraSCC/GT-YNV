# Cómo activar la venta de tiquetes

Mientras `js/config.js` esté vacío, la página funciona en **modo demostración**: se ve la cuadrícula, pero no se puede comprar.
Para vender de verdad necesitas tres cosas: **Supabase** (base de datos), **Wompi** (pagos) y **Brevo** (correo de confirmación).

```
Persona elige número → formulario → se aparta el número 15 min (Supabase)
      → paga en Wompi → Wompi avisa a Supabase (webhook)
      → número en GRIS + correo de confirmación (Brevo)
```

> ⚠️ Antes de recibir dinero real: la rifa debe tener la autorización correspondiente (en Colombia, Coljuegos o la lotería del departamento, según el caso). Pon el número de autorización en la nota legal de `index.html` (busca `número de autorización pendiente`).

---

## 1. Supabase (base de datos) — gratis

1. Crea una cuenta en https://supabase.com → **New project** (región: São Paulo o la más cercana). Guarda la contraseña.
2. Ve a **SQL Editor → New query**, pega todo el archivo `supabase/schema.sql` y dale **Run**. Esto crea:
   - `tiquetes`: los 1000 números y su estado (disponible / reservado / vendido).
   - `compras`: nombre, cédula, celular, correo, **celebración elegida (quince, boda, grado)** y estado del pago.
   - `ventas_confirmadas`: la lista limpia de quién compró qué número (para tu tía; se puede exportar a CSV desde *Table Editor*).
3. Ve a **Project Settings → API** y copia:
   - **Project URL** → va en `supabaseUrl` de `js/config.js`
   - **anon public** → va en `supabaseAnonKey` de `js/config.js`
   - (la **service_role** NO se copia en ningún archivo; Supabase la usa sola en el servidor)

## 2. Wompi (pagos)

En el panel de Wompi de tu tía → **Desarrolladores** encontrarás (primero usa las de **pruebas / Sandbox**):

| Llave | Empieza por | Dónde va |
|---|---|---|
| Llave pública | `pub_test_` / `pub_prod_` | Secreto `WOMPI_PUBLIC_KEY` (paso 4) |
| Secreto de integridad | `test_integrity_` / `prod_integrity_` | Secreto `WOMPI_INTEGRITY_SECRET` (paso 4) |
| Secreto de eventos | `test_events_` / `prod_events_` | Secreto `WOMPI_EVENTS_SECRET` (paso 4) |

Y en **URL de Eventos** pon:
```
https://TU-PROYECTO.supabase.co/functions/v1/wompi-webhook
```

> No se usa un "link de pago" fijo de Wompi: ese link no dice qué número compró cada persona. Aquí la página crea un pago con la referencia del número (ej. `GT-777-…`), y así la base de datos sabe exactamente qué tiquete pagar.

## 3. Brevo (correo de confirmación) — gratis hasta 300 correos/día

1. Crea cuenta en https://www.brevo.com
2. **Senders & IP → Senders → Add a sender**: agrega y verifica el correo que enviará las confirmaciones.
3. **SMTP & API → API Keys → Generate**: copia la llave (`xkeysib-…`).

### ¿Y WhatsApp?
Enviar WhatsApp automático requiere la **API de WhatsApp Business (Meta)**: cuenta de Meta Business verificada, un número que NO esté en la app normal de WhatsApp y una plantilla aprobada por Meta. Toma días y cada mensaje tiene costo. El código ya está listo (`WHATSAPP_TOKEN`, `WHATSAPP_PHONE_ID`, `WHATSAPP_PLANTILLA`), pero **recomiendo empezar solo con correo**. Además, en la página de confirmación aparece un botón para escribirle a tu tía por WhatsApp (pon su número en `whatsappContacto`).

## 4. Subir las funciones del servidor

Instala la herramienta de Supabase (https://supabase.com/docs/guides/cli) y en la carpeta del proyecto:

```bash
supabase login
supabase link --project-ref TU-PROYECTO

supabase secrets set \
  WOMPI_PUBLIC_KEY=pub_test_xxx \
  WOMPI_INTEGRITY_SECRET=test_integrity_xxx \
  WOMPI_EVENTS_SECRET=test_events_xxx \
  VALOR_TIQUETE_COP=50000 \
  SITIO_URL=https://aynarascc.github.io/GT-YNV \
  BREVO_API_KEY=xkeysib-xxx \
  CORREO_REMITENTE=correo-verificado@ejemplo.com

supabase functions deploy reservar
supabase functions deploy wompi-webhook --no-verify-jwt
```

(Los secretos también se pueden poner desde el panel: **Edge Functions → Secrets**.)

## 5. Rellenar `js/config.js`

```js
window.GT_CONFIG = {
  supabaseUrl: "https://TU-PROYECTO.supabase.co",
  supabaseAnonKey: "eyJ...",
  valorTiquete: 50000,
  whatsappContacto: "573001234567",
  wompiAmbiente: "sandbox",   // cambia a "produccion" cuando uses llaves pub_prod_
};
```

## 6. Probar antes de vender

Con las llaves de **Sandbox**, Wompi deja pagar con tarjetas de prueba (aparecen en su documentación). Prueba:
1. Comprar un número con pago **aprobado** → debe quedar gris y llegar el correo.
2. Un pago **rechazado** → el número debe volver a quedar dorado.
3. Abrir el mismo número en dos celulares a la vez → solo uno puede apartarlo.

Cuando todo funcione: cambia las llaves y secretos a los de **producción** (`pub_prod_…`, `prod_integrity_…`, `prod_events_…`), pon `wompiAmbiente: "produccion"` y actualiza la URL de eventos en el panel de producción de Wompi.

> Los nombres de los campos y firmas de Wompi se escribieron siguiendo su documentación (Web Checkout con firma de integridad SHA-256 y eventos con checksum). Si alguna prueba en Sandbox falla con "firma inválida", revisa https://docs.wompi.co → *Widget & Checkout Web* y *Eventos*.

## Seguridad (ya incluida)
- La página pública **solo** puede ver número + estado. Cédulas, nombres y teléfonos no se pueden leer desde el navegador.
- Dos personas no pueden apartar el mismo número (lo controla la base de datos).
- Una misma cédula solo puede tener un número apartado a la vez.
- El número solo pasa a "vendido" cuando **Wompi** confirma el pago y la firma del aviso es válida, y se verifica que el valor pagado sea el correcto.
- Si alguien paga un número que por algún motivo ya estaba vendido, la compra queda como `CONFLICTO` para devolverle el dinero.
