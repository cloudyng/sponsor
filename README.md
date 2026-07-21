# Donate Page — VietQR + SePay

Trang donate tĩnh với QR VietQR (MB Bank), tự nhận diện tiền vào qua **SePay webhook**
xử lý bởi một **Cloudflare Worker** dùng **KV** để lưu giao dịch.

## Luồng hoạt động
```
Người donate → MB Bank → SePay (đọc biến động số dư)
                              │ webhook POST /webhook/sepay
                              ▼
                     Cloudflare Worker → lưu KV (key: DONATE######)
                              ▲
        public/index.html ────┘ GET /api/check?content=...&amount=...
```
1. Người dùng chọn số tiền (10k / 100k / custom) → hiện QR + nội dung `DONATE######`.
2. Chuyển khoản đúng nội dung → SePay bắn webhook → Worker lưu vào KV.
3. Trang poll `/api/check` mỗi 4s → khớp thì hiện **thành công**, quá 5 phút thì **thất bại**.

## Cấu trúc
```
donate-project/
├── worker/
│   ├── src/index.js      # Cloudflare Worker (webhook + /api/check)
│   └── wrangler.toml     # cấu hình + KV binding
├── public/
│   └── index.html        # trang donate (frontend tĩnh)
├── .github/workflows/
│   └── deploy.yml         # (tùy chọn) auto deploy Worker khi push
├── SETUP.md               # hướng dẫn chi tiết
├── .gitignore
└── README.md
```

## Deploy nhanh

### Worker (backend)
```bash
cd worker
npm install -g wrangler        # nếu chưa có
wrangler kv namespace create DONATIONS   # dán id vào wrangler.toml
wrangler secret put SEPAY_API_KEY        # token bạn tự đặt
wrangler deploy                          # -> lấy URL workers.dev
```

### Frontend
- Sửa `API_BASE` trong `public/index.html` thành URL Worker vừa deploy.
- Đưa thư mục `public/` lên GitHub Pages hoặc Cloudflare Pages.

### SePay
- Webhook URL: `https://<worker>.workers.dev/webhook/sepay`
- Xác thực: Header `Authorization: Apikey <SEPAY_API_KEY>`
- Sự kiện: tiền vào (incoming)

Xem **SETUP.md** để có hướng dẫn từng bước đầy đủ.

## Bảo mật
- Secret (SePay/Cloudflare) **không nằm trong repo** — đặt qua `wrangler secret put`.
- `/api/check` là public: ai biết mã `DONATE######` đều gọi được. Với donate thì ổn,
  nhưng đừng dùng endpoint này làm cổng mở khóa tính năng trả phí nếu không xác thực thêm.
- KV eventually-consistent: có thể trễ vài giây sau webhook — không ảnh hưởng vì poll 4s / timeout 5'.
