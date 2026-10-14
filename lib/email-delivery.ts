export const MAACGO_EMAIL_ENDPOINT = "https://edm.cresclab.com/api/email/send";

type Fetcher = typeof fetch;

export type VerificationEmailDelivery = {
  provider: "maacgo";
  messageId: string | null;
  testMode: boolean;
};

type MaacGoResponse = {
  id?: unknown;
  test_mode?: unknown;
  delivery?: unknown;
};

export function maacGoAuthorization(value: string | undefined) {
  const authorization = value?.trim();
  if (!authorization) return null;
  return /^Bearer\s+/i.test(authorization) ? authorization : `Bearer ${authorization}`;
}

export function verificationEmailContent(code: string, ttlMinutes: number) {
  const subject = "【好好吃飯】您的登入驗證碼";
  const text = [
    "確認是您本人",
    "",
    "您好，",
    "謝謝您使用「好好吃飯｜午餐助手」。請在網站中輸入以下 6 位數驗證碼：",
    "",
    code,
    "",
    `驗證碼將於 ${ttlMinutes} 分鐘後失效，且只能使用一次。`,
    "如果不是您本人提出登入或註冊要求，可以直接忽略這封信。",
    "請不要將驗證碼提供給其他人；我們也不會主動向您詢問這組驗證碼。",
    "",
    "好好吃飯｜午餐助手",
    "陪家長理解午餐，也陪孩子慢慢認識食物",
  ].join("\n");
  const html = `<!doctype html>
<html lang="zh-Hant">
  <body style="margin:0;background:#f7f3eb;color:#153447;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
    <div style="max-width:560px;margin:0 auto;padding:40px 24px;">
      <p style="margin:0 0 24px;color:#d95835;font-size:18px;font-weight:800;">好好吃飯</p>
      <div style="padding:32px;border:1px solid #ddd5c8;border-radius:24px;background:#fffdf8;">
        <h1 style="margin:0 0 16px;font-size:28px;line-height:1.25;">確認是您本人 👋</h1>
        <p style="margin:0 0 12px;line-height:1.8;">您好，</p>
        <p style="margin:0 0 24px;line-height:1.8;">謝謝您使用「好好吃飯｜午餐助手」。請在網站中輸入以下 6 位數驗證碼：</p>
        <p style="margin:0 0 24px;padding:18px 20px;border-radius:16px;background:#eef3ea;text-align:center;font-size:34px;font-weight:800;letter-spacing:.22em;">${code}</p>
        <p style="margin:0 0 12px;line-height:1.8;">驗證碼將於 <strong>${ttlMinutes} 分鐘後失效</strong>，且只能使用一次。</p>
        <p style="margin:0;line-height:1.8;color:#566b75;">如果不是您本人提出登入或註冊要求，可以直接忽略這封信。請不要將驗證碼提供給其他人；我們也不會主動向您詢問這組驗證碼。</p>
      </div>
      <p style="margin:24px 0 0;color:#6c7c83;font-size:13px;line-height:1.7;">好好吃飯｜午餐助手<br>陪家長理解午餐，也陪孩子慢慢認識食物</p>
    </div>
  </body>
</html>`;
  return { subject, text, html };
}

export async function sendMaacGoVerificationEmail(options: {
  authorization: string;
  email: string;
  code: string;
  ttlMinutes: number;
  fetcher?: Fetcher;
}): Promise<VerificationEmailDelivery> {
  const authorization = maacGoAuthorization(options.authorization);
  if (!authorization) throw new Error("MAAC Go authorization is not configured");
  const content = verificationEmailContent(options.code, options.ttlMinutes);
  const response = await (options.fetcher || fetch)(MAACGO_EMAIL_ENDPOINT, {
    method: "POST",
    headers: {
      authorization,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      to: options.email,
      from: "好好吃飯｜午餐助手",
      subject: content.subject,
      text: content.text,
      html: content.html,
    }),
  });
  if (!response.ok) {
    throw new Error(`MAAC Go email delivery failed (${response.status})`);
  }

  let payload: MaacGoResponse = {};
  try {
    payload = await response.json() as MaacGoResponse;
  } catch {
    // A successful response without JSON still means the provider accepted it.
  }
  return {
    provider: "maacgo",
    messageId: typeof payload.id === "string" ? payload.id : null,
    testMode: payload.test_mode === true || payload.delivery === "skipped_test_mode",
  };
}
