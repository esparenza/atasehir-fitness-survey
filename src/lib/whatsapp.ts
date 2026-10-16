const GRAPH = "https://graph.facebook.com/v21.0";

function creds() {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneId) throw new Error("WHATSAPP_TOKEN / WHATSAPP_PHONE_NUMBER_ID eksik.");
  return { token, phoneId };
}

async function post(body: unknown) {
  const { token, phoneId } = creds();
  const res = await fetch(`${GRAPH}/${phoneId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`WhatsApp API ${res.status}: ${JSON.stringify(json?.error ?? json)}`);
  }
  return json;
}

export async function sendText(to: string, text: string) {
  return post({
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "text",
    text: { body: text },
  });
}

/**
 * Onaylı şablonu gönderir. Şablon gövdesinde {{1}} değişkeni (üye adı)
 * varsa isim parametresi eklenir.
 */
export async function sendTemplate(to: string, firstName: string) {
  const name = process.env.WHATSAPP_TEMPLATE_NAME;
  if (!name) throw new Error("WHATSAPP_TEMPLATE_NAME eksik.");
  return post({
    messaging_product: "whatsapp",
    to,
    type: "template",
    template: {
      name,
      language: { code: process.env.WHATSAPP_TEMPLATE_LANG || "tr" },
      components: [
        { type: "body", parameters: [{ type: "text", text: firstName }] },
      ],
    },
  });
}
