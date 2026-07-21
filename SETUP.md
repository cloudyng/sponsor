# Setup: SePay → Cloudflare Worker (KV) → donate.html

## Kiến trúc
```
Người donate → MB Bank → SePay (đọc biến động số dư)
                              │ webhook POST /webhook/sepay
                              ▼
                     Cloudflare Worker → lưu KV (key: DONATE######)
                              ▲
        donate.html ──────────┘ GET /api/check?content=...&amount=...
        (GitHub Pages)
```
Không cần Upstash — dùng KV native của Cloudflare (miễn phí).

## 1. Tạo Worker + KV
```bash
npm create cloudflare@latest sepay-worker   # chọn "Hello World Worker"
cd sepay-worker

# thay src/index.js bằng nội dung worker.js
# thay wrangler.toml bằng file wrangler.toml đã cho

# tạo KV namespace
npx wrangler kv namespace create DONATIONS
# -> copy "id" nó in ra, dán vào wrangler.toml (mục [[kv_namespaces]])
```

## 2. Secret + deploy
```bash
npx wrangler secret put SEPAY_API_KEY   # token bạn tự đặt, nhớ để dùng ở bước 3
npx wrangler deploy
```
Sau deploy có URL dạng `https://sepay-worker.<subdomain>.workers.dev`.
→ Dán vào `API_BASE` trong donate.html.

## 3. SePay
1. Đăng ký sepay.vn, liên kết tài khoản MB Bank (00949917961).
2. Cấu hình webhook → thêm:
   - URL: `https://sepay-worker.<subdomain>.workers.dev/webhook/sepay`
   - Xác thực: API Key (Header) → `Authorization: Apikey <SEPAY_API_KEY>`
   - Sự kiện: tiền vào (incoming).
3. Bấm "Gửi thử" để test.

## 4. Deploy donate.html
- Đưa lên GitHub Pages / Cloudflare Pages (host tĩnh bất kỳ).
- Đảm bảo đã sửa `API_BASE`.

---

## Cấu trúc repo
Frontend và Worker để **2 nơi riêng** (frontend là file tĩnh public, Worker chứa secret):
```
sepay-worker/         ← deploy Cloudflare
├── src/index.js      (= worker.js)
└── wrangler.toml

donate-page/          ← deploy GitHub Pages
└── index.html        (= donate.html)
```

## Về GitHub
- Secret SePay KHÔNG đặt trong GitHub — đặt trong Worker qua `wrangler secret put`.
- GitHub Actions chỉ hợp để tự động chạy `wrangler deploy` khi push code; khi đó mới
  cần `CLOUDFLARE_API_TOKEN` + `SEPAY_API_KEY` trong Settings → Secrets → Actions.
- Việc nhận tiền luôn do Worker lo, không phải Actions.

### (Tùy chọn) .github/workflows/deploy.yml
```yaml
name: Deploy Worker
on:
  push: { branches: [main] }
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm install
      - run: echo "${{ secrets.SEPAY_API_KEY }}" | npx wrangler secret put SEPAY_API_KEY
        env: { CLOUDFLARE_API_TOKEN: "${{ secrets.CLOUDFLARE_API_TOKEN }}" }
      - run: npx wrangler deploy
        env: { CLOUDFLARE_API_TOKEN: "${{ secrets.CLOUDFLARE_API_TOKEN }}" }
```
