export type WriterAuthEnv = {
  MCP_OWNER_EMAIL?: string;
  MCP_OWNER_USER_ID?: string;
};

export function authorizeSiteWriter(
  request: Request,
  siteEnv: WriterAuthEnv,
  toolName: string,
) {
  if (toolName === "get_refresh_status") return;

  const userId = request.headers.get("oai-authenticated-user-id")?.trim();
  const userEmail = normalizeEmail(
    request.headers.get("oai-authenticated-user-email"),
  );
  if (!userId && !userEmail) {
    throw new Error("這個更新工具只接受已驗證的 Site 擁有者呼叫");
  }

  const ownerEmail = normalizeEmail(siteEnv.MCP_OWNER_EMAIL);
  if (ownerEmail) {
    if (userEmail !== ownerEmail) {
      throw new Error("目前帳號沒有更新午餐資料的權限");
    }
    return;
  }

  const ownerUserId = siteEnv.MCP_OWNER_USER_ID?.trim();
  if (ownerUserId && userId !== ownerUserId) {
    throw new Error("目前帳號沒有更新午餐資料的權限");
  }
}

function normalizeEmail(value: string | null | undefined) {
  return value?.trim().toLowerCase() || "";
}
