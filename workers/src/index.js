/**
 * Cloudflare Worker — SePay webhook + payment check (dùng KV native của Cloudflare)
 *
 * Endpoints:
 *   POST /webhook/sepay                                  <- SePay gọi khi có tiền vào
 *   GET  /api/check?content=DONATE123456&amount=10000    <- donate.html hỏi
 *
 * Binding cần khai trong wrangler.toml:
 *   [[kv_namespaces]]
 *   binding = "DONATIONS"
 *   id = "<kv-namespace-id>"
 *
 * Secret (npx wrangler secret put SEPAY_API_KEY):
 *   SEPAY_API_KEY - token bạn tự đặt, khớp "Api Key" trong cấu hình webhook SePay
 */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type,Authorization",
    };
    if (request.method === "OPTIONS") return new Response(null, { headers: cors });

    // ---------- 1) SePay webhook ----------
    if (url.pathname === "/webhook/sepay" && request.method === "POST") {
      const auth = request.headers.get("Authorization") || "";
      if (auth !== `Apikey ${env.SEPAY_API_KEY}`) {
        return json({ success: false, error: "unauthorized" }, 401, cors);
      }

      const tx = await request.json();
      if ((tx.transferType || "").toLowerCase() !== "in") {
        return json({ success: true, skipped: "not incoming" }, 200, cors);
      }

      const amount  = Math.round(Number(tx.transferAmount) || 0);
      const content = (tx.content || tx.description || "").toUpperCase();
      const txid    = String(tx.referenceCode || tx.id || Date.now());

      const m = content.match(/DONATE\d{6}/);
      if (m) {
        // KV: tự hết hạn sau 30 phút (donate timeout 5')
        await env.DONATIONS.put(
          m[0],
          JSON.stringify({ paid: true, amount, txid, at: Date.now() }),
          { expirationTtl: 1800 }
        );
      }
      return json({ success: true }, 200, cors);
    }

    // ---------- 2) Frontend hỏi trạng thái ----------
    if (url.pathname === "/api/check" && request.method === "GET") {
      const content = (url.searchParams.get("content") || "").toUpperCase();
      const amount  = Math.round(Number(url.searchParams.get("amount")) || 0);
      if (!content) return json({ paid: false }, 200, cors);

      const raw = await env.DONATIONS.get(content);
      if (!raw) return json({ paid: false }, 200, cors);

      const data = JSON.parse(raw);
      if (data.amount >= amount) {
        return json({ paid: true, txid: data.txid, amount: data.amount }, 200, cors);
      }
      return json({ paid: false, reason: "amount_mismatch" }, 200, cors);
    }

    return json({ error: "not found" }, 404, cors);
  },
};

function json(obj, status, cors) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json", ...cors },
  });
}
