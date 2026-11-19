// Función "wompi-webhook": Wompi la llama cada vez que cambia un pago.
// Si el pago fue APROBADO: el número queda vendido (gris) y se avisa al comprador.
// Si fue rechazado/anulado: el número vuelve a quedar libre.
// Secretos necesarios:
//   WOMPI_EVENTS_SECRET                      (obligatorio)
//   BREVO_API_KEY, CORREO_REMITENTE          (correo de confirmación — recomendado)
//   WHATSAPP_TOKEN, WHATSAPP_PHONE_ID, WHATSAPP_PLANTILLA (opcional, WhatsApp Cloud API)
// Importante: al desplegar usa --no-verify-jwt (Wompi no envía token de Supabase).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

async function sha256(text: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
const get = (obj: any, path: string) => path.split(".").reduce((o, k) => (o == null ? o : o[k]), obj);

const NOMBRES: Record<string, string> = { quince: "Tus quince", boda: "Tu boda soñada", grado: "Tu grado universitario" };

async function enviarCorreo(c: any) {
  const key = Deno.env.get("BREVO_API_KEY");
  const remitente = Deno.env.get("CORREO_REMITENTE");
  if (!key || !remitente) return false;
  const num = String(c.numero).padStart(3, "0");
  const html = `
  <div style="background:#0b0a08;padding:32px;font-family:Georgia,serif;color:#f0e9dc">
    <p style="color:#c8a45c;letter-spacing:3px;font-size:11px;font-family:Arial">GOLDEN TICKET · YENOVA CUPCAKES</p>
    <h1 style="font-weight:400;font-size:30px;margin:10px 0">¡Tu tiquete está confirmado, ${c.nombre.split(" ")[0]}!</h1>
    <div style="border:1px solid #c8a45c;padding:22px;margin:22px 0;text-align:center;background:linear-gradient(130deg,#9b783d,#e9d39a,#a47f40);color:#21190d">
      <div style="font-family:Arial;font-size:11px;letter-spacing:3px">TU NÚMERO</div>
      <div style="font-size:54px">${num}</div>
      <div style="font-family:Arial;font-size:11px;letter-spacing:2px">${NOMBRES[c.celebracion] ?? c.celebracion}</div>
    </div>
    <p style="font-family:Arial;font-size:14px;line-height:1.7;color:#cfc6b6">
      Recibimos tu pago. Guarda este correo como comprobante.<br>
      Referencia: <b>${c.referencia}</b><br>Cédula: ${c.cedula}
    </p>
    <p style="font-family:Arial;font-size:12px;color:#8f877a">¡Mucha suerte! Te avisaremos la fecha del sorteo.</p>
  </div>`;
  const r = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": key, "Content-Type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      sender: { name: "Golden Ticket · YeNoVa", email: remitente },
      to: [{ email: c.email, name: c.nombre }],
      subject: `Tu Golden Ticket #${num} está confirmado ✦`,
      htmlContent: html,
    }),
  });
  return r.ok;
}

async function enviarWhatsApp(c: any) {
  const token = Deno.env.get("WHATSAPP_TOKEN");
  const phoneId = Deno.env.get("WHATSAPP_PHONE_ID");
  const plantilla = Deno.env.get("WHATSAPP_PLANTILLA");
  if (!token || !phoneId || !plantilla) return false;
  // La plantilla debe estar aprobada por Meta con 2 variables: {{1}} nombre, {{2}} número.
  const r = await fetch(`https://graph.facebook.com/v20.0/${phoneId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: `57${c.telefono}`,
      type: "template",
      template: {
        name: plantilla,
        language: { code: "es" },
        components: [{ type: "body", parameters: [
          { type: "text", text: c.nombre.split(" ")[0] },
          { type: "text", text: String(c.numero).padStart(3, "0") },
        ] }],
      },
    }),
  });
  return r.ok;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("ok");
  let ev: any;
  try { ev = await req.json(); } catch { return new Response("bad json", { status: 400 }); }

  // 1) Verificar que el aviso viene de verdad de Wompi
  const props: string[] = ev?.signature?.properties ?? [];
  const cadena = props.map((p) => String(get(ev.data, p))).join("") + String(ev.timestamp) + Deno.env.get("WOMPI_EVENTS_SECRET");
  const checksum = await sha256(cadena);
  const recibido = String(ev?.signature?.checksum ?? req.headers.get("x-event-checksum") ?? "").toLowerCase();
  if (!recibido || checksum !== recibido) return new Response("firma inválida", { status: 401 });

  if (ev.event !== "transaction.updated") return new Response("ignorado");
  const tx = ev.data?.transaction;
  if (!tx?.reference) return new Response("sin referencia");

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // 2) Revisar que el valor pagado sea el correcto
  const { data: compra } = await db.from("compras").select("*").eq("referencia", tx.reference).maybeSingle();
  if (!compra) return new Response("referencia desconocida"); // 200 para que Wompi no reintente sin fin
  const estado = tx.status === "APPROVED" && Number(tx.amount_in_cents) !== Number(compra.valor_centavos) ? "ERROR" : tx.status;

  // 3) Registrar el resultado (vendido / liberado)
  const { data, error } = await db.rpc("registrar_pago", { p_referencia: tx.reference, p_estado: estado, p_wompi_id: String(tx.id) });
  if (error) return new Response(error.message, { status: 500 }); // Wompi reintentará

  // 4) Avisar al comprador una sola vez
  if (data?.[0]?.estado_final === "APPROVED" && !compra.notificado) {
    const okCorreo = await enviarCorreo(compra).catch(() => false);
    const okWa = await enviarWhatsApp(compra).catch(() => false);
    if (okCorreo || okWa) await db.from("compras").update({ notificado: true }).eq("id", compra.id);
  }
  return new Response("ok");
});
