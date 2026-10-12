import { env } from "cloudflare:workers";
import {
  getRefreshStatus,
  refreshSchoolGroup,
  retryIncompleteSchools,
  type SiteEnv,
} from "@/lib/refresh";
import { authorizeSiteWriter } from "@/lib/mcp-auth";

export const dynamic = "force-dynamic";

type JsonRpcRequest = {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: Record<string, unknown>;
};

const tools = [
  {
    name: "refresh_school_group",
    description:
      "依既定的三個 81 校批次，從教育部校園食材登錄平臺抓取指定日期的同日午餐，完成結構驗證後把 reviewed JSON 寫入 R2，並更新 D1 索引。每次只處理少量學校；若 remaining 大於 0，請用相同參數繼續呼叫。",
    inputSchema: {
      type: "object",
      properties: {
        group: { type: "integer", enum: [1, 2, 3] },
        meal_date: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
        max_schools: { type: "integer", minimum: 1, maximum: 3, default: 2 },
      },
      required: ["group"],
      additionalProperties: false,
    },
  },
  {
    name: "retry_incomplete_schools",
    description:
      "補抓指定日期尚未執行，或最新狀態為 failed、not_published 的學校。每次只處理少量學校；若 remaining 大於 0，請用相同參數繼續呼叫。",
    inputSchema: {
      type: "object",
      properties: {
        meal_date: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
        max_schools: { type: "integer", minimum: 1, maximum: 3, default: 2 },
      },
      additionalProperties: false,
    },
  },
  {
    name: "get_refresh_status",
    description: "查看指定日期三批抓取工作與最新學校狀態，不會向來源網站送出請求。",
    inputSchema: {
      type: "object",
      properties: {
        meal_date: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
      },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
  },
];

export async function POST(request: Request) {
  let message: JsonRpcRequest;
  try {
    message = (await request.json()) as JsonRpcRequest;
  } catch {
    return rpcError(null, -32700, "Invalid JSON");
  }
  if (message.jsonrpc !== "2.0" || !message.method) {
    return rpcError(message.id ?? null, -32600, "Invalid Request");
  }
  if (message.method === "notifications/initialized") return new Response(null, { status: 204 });
  if (message.method === "initialize") {
    return rpcResult(message.id, {
      protocolVersion: "2025-06-18",
      capabilities: { tools: { listChanged: false } },
      serverInfo: { name: "demeter-school-lunch", version: "1.0.0" },
    });
  }
  if (message.method === "ping") return rpcResult(message.id, {});
  if (message.method === "tools/list") return rpcResult(message.id, { tools });
  if (message.method !== "tools/call") {
    return rpcError(message.id ?? null, -32601, "Method not found");
  }

  const params = message.params ?? {};
  const name = String(params.name || "");
  const args = isObject(params.arguments) ? params.arguments : {};
  try {
    authorizeSiteWriter(request, env as SiteEnv, name);
    let result: unknown;
    if (name === "refresh_school_group") {
      result = await refreshSchoolGroup(env as SiteEnv, {
        group: Number(args.group),
        meal_date: optionalString(args.meal_date),
        max_schools: optionalNumber(args.max_schools),
      });
    } else if (name === "retry_incomplete_schools") {
      result = await retryIncompleteSchools(env as SiteEnv, {
        meal_date: optionalString(args.meal_date),
        max_schools: optionalNumber(args.max_schools),
      });
    } else if (name === "get_refresh_status") {
      result = await getRefreshStatus(env as SiteEnv, optionalString(args.meal_date));
    } else {
      return rpcToolError(message.id, `Unknown tool: ${name}`);
    }
    return rpcResult(message.id, {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      structuredContent: result,
      isError: false,
    });
  } catch (error) {
    return rpcToolError(
      message.id,
      error instanceof Error ? error.message : String(error),
    );
  }
}

function rpcResult(id: JsonRpcRequest["id"], result: unknown) {
  return Response.json({ jsonrpc: "2.0", id: id ?? null, result });
}

function rpcError(id: JsonRpcRequest["id"], code: number, message: string) {
  return Response.json({ jsonrpc: "2.0", id: id ?? null, error: { code, message } });
}

function rpcToolError(id: JsonRpcRequest["id"], message: string) {
  return rpcResult(id, {
    content: [{ type: "text", text: message }],
    isError: true,
  });
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function optionalString(value: unknown) {
  return typeof value === "string" && value ? value : undefined;
}

function optionalNumber(value: unknown) {
  return value === undefined ? undefined : Number(value);
}
