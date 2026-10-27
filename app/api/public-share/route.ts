import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createSupabasePublicServerClient } from "@/lib/supabase/public-server";
import { hashPublicShareToken } from "@/lib/public-share-token";
import {
  publicSessionShareSchema,
  publicShareRequestSchema,
} from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RPCErrorSchema = z.object({
  ok: z.literal(false),
  code: z.enum(["invalid_link", "rate_limited", "invalid_request"]),
  retry_after_seconds: z.number().int().positive().optional(),
}).strict();

export async function POST(request: NextRequest) {
  const contentType = request.headers.get("content-type") ?? "";
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (!contentType.toLowerCase().startsWith("application/json") || contentLength > 2048) {
    return json({ error: "Yêu cầu không hợp lệ." }, 400);
  }

  let body: unknown;
  try {
    const text = await request.text();
    if (text.length > 2048) return json({ error: "Yêu cầu quá lớn." }, 413);
    body = JSON.parse(text);
  } catch (error) {
    if (error instanceof SyntaxError) return json({ error: "Nội dung JSON không hợp lệ." }, 400);
    throw error;
  }

  const parsed = publicShareRequestSchema.safeParse(body);
  if (!parsed.success) {
    return json({ error: parsed.error.issues[0]?.message ?? "Yêu cầu không hợp lệ." }, 400);
  }

  const supabase = createSupabasePublicServerClient();
  const tokenHash = hashPublicShareToken(parsed.data.token);

  const { data, error } = await supabase.rpc("get_public_session_share", { p_token_hash: tokenHash });
  if (error) return json({ error: "Không thể tải dữ liệu buổi đánh. Vui lòng thử lại." }, 503);
  const failure = parseRpcFailure(data);
  if (failure) return rpcErrorResponse(failure);
  const share = publicSessionShareSchema.safeParse(data);
  if (!share.success) return json({ error: "Dữ liệu chia sẻ không hợp lệ." }, 503);
  return json(share.data, 200);
}

function parseRpcFailure(value: unknown) {
  const parsed = RPCErrorSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

function rpcErrorResponse(error: { code: string; retry_after_seconds?: number }) {
  if (error.code === "rate_limited") {
    return json({ error: "Đã đạt giới hạn thao tác. Vui lòng thử lại sau.", code: error.code }, 429, {
      "Retry-After": String(error.retry_after_seconds ?? 60),
    });
  }
  const status = error.code === "invalid_link" ? 404 : 400;
  return json({ error: error.code === "invalid_link" ? "Liên kết không hợp lệ hoặc đã bị thu hồi." : "Không thể tải thông tin chia sẻ.", code: error.code }, status);
}

function json(body: unknown, status: number, headers: Record<string, string> = {}) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store, max-age=0", ...headers },
  });
}
