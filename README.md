# RallyTeam — Quản lý tiền đội cầu lông

Ứng dụng dùng Next.js App Router, TypeScript, Tailwind CSS và Supabase. Giao diện tiếng Việt, responsive. Quản trị viên đăng nhập tại `/login` bằng username/mật khẩu chung; thành viên không cần tài khoản, chỉ dùng link riêng của buổi tại `/share/[token]`.

## Yêu cầu môi trường

- Node.js 18.17 trở lên.
- Yarn Classic 1.x.
- Project Supabase.
- Docker Desktop nếu muốn chạy Supabase local.

## Cài package và chạy local

```powershell
yarn install --frozen-lockfile
Copy-Item .env.example .env.local
```

Điền các biến môi trường trong `.env.local`, rồi chạy:

```powershell
yarn dev
```

Mở `http://localhost:3000`. Các lệnh kiểm tra:

```powershell
yarn lint
yarn typecheck
yarn test
yarn build
```

## Biến môi trường quản trị

Lấy Supabase URL, publishable key và service-role key trong Supabase Dashboard → **Project Settings → API Keys**. Chỉ URL và publishable key được đặt trong `NEXT_PUBLIC_*`.

Tạo hash mật khẩu trong terminal tương tác:

```powershell
node scripts/hash-admin-password.mjs
```

Nhập mật khẩu dài ít nhất 12 ký tự hai lần; ký tự không hiển thị khi nhập. Script in ra hai dạng: dòng có dấu `\` để dán vào `.env.local` và giá trị không có dấu `\` để nhập vào Vercel. Next.js mở rộng `$VAR` trong file env, vì vậy không bỏ dấu `\` trước các dấu `$` trong hash khi cấu hình local. Tạo username riêng và khóa ký session ngẫu nhiên:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Thiết lập các biến:

```env
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<publishable-key>
SUPABASE_SERVICE_ROLE_KEY=<server-only-service-role-key>
ADMIN_USERNAME=<username-quan-tri>
ADMIN_PASSWORD_HASH=scrypt\$<salt>\$<hash>
ADMIN_SESSION_SECRET=<chuoi-ngau-nhien-it-nhat-32-ky-tu>
```

`SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_PASSWORD_HASH` và `ADMIN_SESSION_SECRET` là secrets phía server. Không đặt chúng trong biến `NEXT_PUBLIC_*`, mã nguồn hoặc Git. Thay `ADMIN_SESSION_SECRET` sẽ vô hiệu hóa mọi phiên quản trị đang tồn tại. Phiên đăng nhập dùng cookie HttpOnly, SameSite Strict và hết hạn sau 8 giờ.

## Supabase, migration, RLS và Storage

1. Cài/đăng nhập Supabase CLI, liên kết đúng project:

   ```powershell
   npx supabase login
   npx supabase link --project-ref <project-ref>
   npx supabase migration list --linked
   ```

2. Xem các migration pending và xác nhận đúng project trước khi áp dụng. Sao lưu database production theo quy trình của bạn:

   ```powershell
   npx supabase db push
   npx supabase migration list --linked
   ```

3. Migration ban đầu và các migration tiếp theo nằm trong `supabase/migrations/`; migration `20261027010822_shared_admin_auth.sql` tạo rate limit đăng nhập quản trị. Test database transactional nằm trong `supabase/tests/`.
4. Nếu chưa có bản ghi đội nào, đăng nhập quản trị và mở `/admin/setup`; thay tên đội mẫu trong SQL bằng tên thật rồi chạy một lần trong Supabase SQL Editor.

Các bảng dữ liệu bật RLS; các role `anon`/`authenticated` không được cấp ghi công khai. RPC công khai cho link thành viên chỉ cho phép đọc projection của buổi hoặc xác nhận payment thuộc đúng token. Bucket QR là ảnh công khai chỉ đọc; upload chỉ qua thao tác quản trị phía server.

**Lưu ý quyền truy cập quản trị:** thao tác quản trị phía server dùng service-role key để làm việc với schema hiện có và vì thế vượt qua RLS của PostgreSQL. Mọi trang và Server Action quản trị phải qua kiểm tra session server-side (`requireAdminContext`); key chỉ được tạo trong module server-only và tuyệt đối không gửi xuống client. RLS vẫn chặn quyền trực tiếp từ browser roles, nhưng không phải lớp lọc dữ liệu cho truy vấn service-role. Giới hạn truy cập server, bảo vệ secrets Vercel và không thêm endpoint quản trị không được xác thực.

Supabase Auth email/OTP/OAuth và callback email không được dùng cho đăng nhập quản trị ở kiến trúc này. Cấu hình SMTP không cần thiết.

## Đăng nhập và phân quyền

- `/login`: form username/mật khẩu; server so sánh username và xác minh hash scrypt, kiểm tra rate limit qua RPC database, sau đó tạo cookie ký HMAC.
- `/admin`: điểm vào trang quản trị, chuyển tới dashboard hiện có tại `/`.
- Mọi route quản trị được middleware kiểm tra session; Server Actions kiểm tra lại trong `requireAdminContext`, không dựa vào việc ẩn nút UI.
- `/admin/login` và `/auth/callback` cũ chuyển về `/login`.
- `/share/[token]`: link bearer ngẫu nhiên mạnh; token trong URL là thông tin cho phép xem buổi và đánh dấu payment. Server chỉ chấp nhận thao tác cho payment của buổi được token đó cấp quyền. Link bị thu hồi sẽ không còn hiệu lực.
- Trang share không yêu cầu tài khoản. Người tick không được xác thực danh tính; trạng thái là xác nhận thủ công, không phải xác minh ngân hàng. Hạn chế chia sẻ link và không ghi token vào log ứng dụng.

## Ngân hàng và QR

Sau khi đăng nhập, mở **Cài đặt** để nhập thông tin thật do quản lý cung cấp và tải QR thật PNG/JPEG/WebP tối đa 5 MB hoặc cấu hình URL HTTPS. Không có dữ liệu ngân hàng/QR mẫu. Thông tin này được hiển thị cho người có link chia sẻ; không đưa thông tin nhạy cảm khác vào bucket QR.

## Deploy Vercel

Chủ dự án cần tự cấp quyền Git/Vercel/Supabase. Repo này không tự deploy.

1. Import repository vào Vercel, chọn preset Next.js. Dùng build command `yarn build`; không cấu hình static export.
2. Trên **Project Settings → Environment Variables**, đặt các giá trị phù hợp cho Production:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `ADMIN_USERNAME`
   - `ADMIN_PASSWORD_HASH`
   - `ADMIN_SESSION_SECRET`
3. Các biến cuối cùng không bắt đầu bằng `NEXT_PUBLIC_`. Dùng cùng bộ biến cho Preview chỉ khi bạn thực sự muốn cấp quyền quản trị trên preview; tốt nhất dùng credentials/database riêng.
4. Trước khi deploy code cần migration mới, kiểm tra `npx supabase migration list --linked` và chạy `npx supabase db push` với project-ref production đã xác minh.
5. Deploy; sau khi thay đổi Environment Variables, redeploy để build mới nhận biến. Cấu hình DNS/custom domain và HTTPS trong Vercel.
6. Không cần thêm Supabase Auth Site URL, redirect callback hoặc CORS cho đăng nhập quản trị vì không dùng email/OTP/OAuth và gọi Supabase quản trị từ server.

## Kiểm tra sau deploy

1. Mở `/login`; thử sai credentials và xác nhận không vào được trang quản trị.
2. Đăng nhập đúng; thử mở `/`, `/admin`, `/members`, `/sessions`, `/settings`, `/reports` và đăng xuất. Sau logout, truy cập lại phải bị chuyển về login.
3. Tạo thành viên và buổi đánh; kiểm tra chia VND, phần dư, khoản chi và dữ liệu sau khi tải lại.
4. Tạo link chia sẻ; mở trên thiết bị khác, xác nhận chỉ hiển thị buổi tương ứng, QR và các thao tác payment được phép.
5. Tick/bỏ tick payment; xác nhận số tổng hợp và lịch sử audit cập nhật. Thu hồi/tạo lại link rồi thử link cũ.
6. Kiểm tra báo cáo, đóng buổi, QR thật, Storage policy và RLS.
7. Xem Vercel runtime logs và Supabase logs. Không ghi lại hay chia sẻ password, hash, cookie, service-role key hoặc link token.

## Bảo vệ secrets

`.env.local` nằm trong `.gitignore`; `.env.example` không chứa secret. Trước commit kiểm tra `git status` và staged diff. Nếu lộ password, hash, service-role key hoặc session secret, hãy thay/rotate ngay tại nơi cấu hình và redeploy.
