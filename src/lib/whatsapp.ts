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
    const errObj = json?.error ?? {};
    const code = errObj.code;
    let hint = errObj.message || JSON.stringify(errObj);
    if (code === 190) {
      hint =
        "WhatsApp Access Token süresi dolmuş (Kod 190). Meta Business ayarlarından kalıcı (System User) token alıp WHATSAPP_TOKEN değişkenini güncelleyin.";
    } else if (code === 131030) {
      hint =
        "Alıcı numara Meta Test listesinde ekli değil (Kod 131030). Meta Developer > WhatsApp > API Setup'tan numarayı test listesine ekleyin.";
    } else if (code === 131047) {
      hint =
        "24 saatlik pencere kapalı (Kod 131047). Üyeye önce onaylı şablon mesajı gönderilmelidir.";
    }
    const err = new Error(`WhatsApp API ${res.status}: ${hint}`) as Error & { code?: number };
    err.code = code;
    throw err;
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
 * varsa isim parametresi eklenir; eğer şablonda değişken yoksa (Kod 132000/132012)
 * otomatik olarak parametresiz gönderim dener.
 */
export async function sendTemplate(to: string, firstName: string) {
  const name = process.env.WHATSAPP_TEMPLATE_NAME;
  if (!name) throw new Error("WHATSAPP_TEMPLATE_NAME eksik.");
  const lang = process.env.WHATSAPP_TEMPLATE_LANG || "tr";

  try {
    return await post({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "template",
      template: {
        name,
        language: { code: lang },
        components: [
          { type: "body", parameters: [{ type: "text", text: firstName }] },
        ],
      },
    });
  } catch (e: any) {
    if (e?.code === 132000 || e?.code === 132012) {
      return await post({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "template",
        template: {
          name,
          language: { code: lang },
        },
      });
    }
    throw e;
  }
}
