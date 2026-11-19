// Función "reservar": aparta un número por 15 minutos, guarda los datos del
// comprador y devuelve los datos firmados para abrir el pago de Wompi.
// Secretos necesarios (Supabase → Edge Functions → Secrets):
//   WOMPI_PUBLIC_KEY, WOMPI_INTEGRITY_SECRET, VALOR_TIQUETE_COP (ej. 50000), SITIO_URL
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

async function sha256(text: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const MENSAJES: Record<string, string> = {
  no_disponible: "Ese número acaba de ser apartado o vendido. Elige otro, por favor.",
  ya_tiene_reserva: "Ya tienes un número apartado en proceso de pago. Termina ese pago o espera 15 minutos.",
  debe_aceptar_datos: "Debes autorizar el tratamiento de tus datos para continuar.",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);

  let d: Record<string, unknown>;
  try { d = await req.json(); } catch { return json({ error: "Datos inválidos" }, 400); }

  const numero = Number(d.numero);
  const nombre = String(d.nombre ?? "").trim().slice(0, 120);
  const cedula = String(d.cedula ?? "").replace(/\D/g, "").slice(0, 15);
  const telefono = String(d.telefono ?? "").replace(/\D/g, "").slice(-10);
  const email = String(d.email ?? "").trim().toLowerCase().slice(0, 160);
  const celebracion = String(d.celebracion ?? "");
  const acepta = d.acepta === true;

  if (!Number.isInteger(numero) || numero < 1 || numero > 1000) return json({ error: "Número inválido" }, 400);
  if (nombre.length < 5) return json({ error: "Escribe tu nombre completo" }, 400);
  if (cedula.length < 5) return json({ error: "Cédula inválida" }, 400);
  if (!/^3\d{9}$/.test(telefono)) return json({ error: "Celular inválido (10 dígitos, empieza por 3)" }, 400);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "Correo inválido" }, 400);
  if (!["quince", "boda", "grado"].includes(celebracion)) return json({ error: "Elige una celebración" }, 400);

  const valorCop = Number(Deno.env.get("VALOR_TIQUETE_COP") ?? "50000");
  const centavos = valorCop * 100;
  const minutos = 15;

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data, error } = await db.rpc("reservar_tiquete", {
    p_numero: numero, p_nombre: nombre, p_cedula: cedula, p_telefono: telefono, p_email: email,
    p_celebracion: celebracion, p_acepta: acepta, p_valor: centavos, p_minutos: minutos,
  });
  if (error) {
    const code = Object.keys(MENSAJES).find((k) => error.message.includes(k));
    return json({ error: code ? MENSAJES[code] : "No se pudo apartar el número. Intenta de nuevo." }, code ? 409 : 500);
  }

  const { referencia, reservado_hasta } = data[0];
  // El pago vence al mismo tiempo que la reserva, para que nadie pague un número vencido.
  const expiracion = new Date(reservado_hasta).toISOString();
  const firma = await sha256(`${referencia}${centavos}COP${expiracion}${Deno.env.get("WOMPI_INTEGRITY_SECRET")}`);
  const sitio = (Deno.env.get("SITIO_URL") ?? "").replace(/\/$/, "");

  return json({
    checkout: {
      "public-key": Deno.env.get("WOMPI_PUBLIC_KEY"),
      "currency": "COP",
      "amount-in-cents": String(centavos),
      "reference": referencia,
      "signature:integrity": firma,
      "expiration-time": expiracion,
      "redirect-url": `${sitio}/gracias.html`,
      "customer-data:email": email,
      "customer-data:full-name": nombre,
      "customer-data:phone-number": telefono,
      "customer-data:phone-number-prefix": "+57",
      "customer-data:legal-id": cedula,
      "customer-data:legal-id-type": "CC",
    },
    referencia,
    vence: expiracion,
  });
});
