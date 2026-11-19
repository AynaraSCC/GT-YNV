// =====================================================================
// CONFIGURACIÓN DE VENTA — rellena esto cuando tengas Supabase y Wompi.
// Mientras supabaseUrl esté vacío, la cuadrícula funciona en modo
// demostración (no se puede comprar).
// Estas llaves son PÚBLICAS: es seguro que estén aquí.
// ¡NUNCA pongas aquí el secreto de integridad ni el de eventos de Wompi!
// =====================================================================
window.GT_CONFIG = {
  supabaseUrl: "",        // ej. "https://abcdefgh.supabase.co"
  supabaseAnonKey: "",    // Supabase → Project Settings → API → anon public
  valorTiquete: 50000,    // en pesos (debe coincidir con VALOR_TIQUETE_COP del servidor)
  // WhatsApp de contacto de tu tía (con 57 delante, sin + ni espacios). Opcional.
  whatsappContacto: "",   // ej. "573001234567"
  // "sandbox" mientras pruebas con llaves pub_test_..., "produccion" con pub_prod_...
  wompiAmbiente: "sandbox",
};
