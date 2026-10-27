# RallyTeam — Quản lý tiền đội cầu lông

Ứng dụng dùng Next.js App Router, TypeScript, Tailwind CSS và Supabase. Giao diện tiếng Việt, responsive. Đăng nhập legacy bằng username/mật khẩu cấu hình server vẫn là chế độ mặc định trong giai đoạn chuyển tiếp; mô hình tài khoản database/multi-team chỉ hoạt động sau khi áp dụng migration, bootstrap và bật rõ ràng. Thành viên không cần tài khoản, chỉ dùng link riêng của buổi tại `/share/[token]`.

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

Lấy Supabase URL, publishable key và secret key trong Supabase Dashboard → **Project Settings → API Keys**. Chỉ URL và publishable key được đặt trong `NEXT_PUBLIC_*`. Secret key mới (`sb_secret_...`) được khuyến nghị thay cho legacy `service_role` key; ứng dụng vẫn hỗ trợ biến `SUPABASE_SERVICE_ROLE_KEY` cũ để tương thích.

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
SUPABASE_SECRET_KEY=<server-only-secret-key>
ADMIN_USERNAME=<username-quan-tri>
ADMIN_PASSWORD_HASH=scrypt\$<salt>\$<hash>
ADMIN_SESSION_SECRET=<chuoi-ngau-nhien-it-nhat-32-ky-tu>
```

`SUPABASE_SECRET_KEY` (hoặc legacy `SUPABASE_SERVICE_ROLE_KEY`), `ADMIN_PASSWORD_HASH` và `ADMIN_SESSION_SECRET` là secrets phía server. Không đặt chúng trong biến `NEXT_PUBLIC_*`, mã nguồn hoặc Git. Thay `ADMIN_SESSION_SECRET` sẽ vô hiệu hóa mọi phiên quản trị đang tồn tại. Phiên đăng nhập dùng cookie HttpOnly, SameSite Strict và hết hạn sau 8 giờ.

Nếu đăng nhập hiện thông báo không thể kiểm tra giới hạn đăng nhập, hãy kiểm tra Vercel Runtime Logs: lỗi `PGRST202` thường chỉ ra RPC/migration chưa có trong schema cache hoặc chưa được áp dụng; lỗi quyền/401 thường chỉ ra key server sai, đã thu hồi, hoặc không thuộc project trong `NEXT_PUBLIC_SUPABASE_URL`. Xác nhận migration `20261027010822_shared_admin_auth.sql` đã áp dụng trên đúng project trước khi chạy `npx supabase db push`, sau đó redeploy để server nhận các environment variable mới. Không bỏ qua RPC rate limit để khắc phục lỗi này.

## Multi-team và triển khai tài khoản database

Trạng thái Supabase production cho project được liên kết tại thời điểm **2026-10-27**:

- Ba migration `20261027125059_multi_team_identity_foundation.sql`, `20261027133738_expense_allocations_and_venue_qr.sql` và `20261027134238_super_admin_management_operations.sql` đã được áp dụng; migration history đã đối chiếu.
- Đã bootstrap một Super Admin và ánh xạ tài khoản quản trị legacy vào team hiện có. Đăng nhập database đã được xác nhận trên máy local; `ADMIN_AUTH_MODE` trên Vercel chưa được thay đổi.
- Sau migration, số liệu đã đối chiếu: 1 team, 9 thành viên, 3 buổi, 22 người tham gia, 7 khoản chi, 22 payments; tổng chi, phân bổ và công nợ đều 1.014.000 VND, không có khoản phân bổ lệch.
- Snapshot trước migration và file QR Storage đã được lưu ngoài repository trong thư mục backup cục bộ. Cần duy trì backup theo chính sách vận hành của dự án.

Không chạy lại `db push` cho các migration này; chúng đã có trong remote migration history. Với mọi migration mới, kiểm tra project-ref, review `db push --dry-run`, tạo snapshot có thể khôi phục, rồi mới áp dụng bằng Supabase CLI.

### Cutover Vercel

Chưa có xác nhận về các biến môi trường hiện đang đặt trong Vercel hoặc deployment production. Trước khi chuyển traffic:

1. Kiểm tra trên Vercel Production các biến `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` (hoặc `SUPABASE_SERVICE_ROLE_KEY`), `ADMIN_SESSION_SECRET` và `ADMIN_AUTH_MODE=database`. Khóa session phải ngẫu nhiên, tối thiểu 32 ký tự và riêng cho production; tuyệt đối không dùng `NEXT_PUBLIC_` cho secret.
2. Giữ `ADMIN_USERNAME`, `ADMIN_PASSWORD_HASH` và `ADMIN_SESSION_SECRET` trong giai đoạn rollback. Không đặt `BOOTSTRAP_SUPER_ADMIN_USERNAME` hoặc `BOOTSTRAP_SUPER_ADMIN_PASSWORD` trên Vercel.
3. Nếu Preview deployments dùng chung Supabase production, không cấp chúng production secret key hoặc quyền quản trị; ưu tiên project/database và tài khoản riêng cho Preview.
4. Deploy ứng dụng tương thích, sau đó kiểm tra `/login` bằng tài khoản Super Admin (vào `/system-admin`) và Team Admin (vào team dashboard), đăng xuất, session, tạo/chỉnh sửa khoản chi, phân bổ, trang chia sẻ chỉ đọc, và tải/cập nhật/xóa QR. Theo dõi Vercel Runtime Logs trong lúc smoke test; không ghi mật khẩu, token hoặc service-role key vào log.
5. Nếu đăng nhập database gặp sự cố và cần rollback nhanh, đặt `ADMIN_AUTH_MODE=legacy` trong Production environment rồi redeploy. Giữ migration và tài khoản database nguyên trạng trong khi điều tra; không rollback schema bằng thao tác xóa bảng.

Bootstrap đã hoàn tất; không chạy lại `yarn bootstrap:admins` vì đây là thao tác chỉ chạy lần đầu. Khi cần thêm admin hoặc reset mật khẩu, dùng `/system-admin`. Nếu phải bootstrap trong môi trường khác, chỉ cấp credential bootstrap tạm thời qua secret manager/process environment, không ghi mật khẩu vào shell history; `LEGACY_ADMIN_TEAM_ID` chỉ cần khi có nhiều team legacy và phải là ID của team đã tồn tại.

Database lưu password hash scrypt, opaque session token chỉ lưu dưới dạng SHA-256 hash, và session được xác minh lại với trạng thái tài khoản, membership và team khi request. `/system-admin` dành riêng cho Super Admin được bootstrap; không có public signup. Các function quản trị/chi phí chỉ cấp execute cho `service_role`, nên chỉ gọi qua server action đã xác thực. Không đưa secret/service-role key vào client.

## Supabase, migration, RLS và Storage

1. Cài/đăng nhập Supabase CLI, liên kết đúng project:

   ```powershell
   npx supabase login
   npx supabase link --project-ref <project-ref>
   npx supabase migration list --linked
   ```

2. Trước mỗi migration mới, xem pending migration và xác nhận đúng project; **bắt buộc** có backup database production đã kiểm thử khôi phục:

   ```powershell
   npx supabase db push --dry-run
   npx supabase db push
   npx supabase migration list --linked
   ```

3. Migration nằm trong `supabase/migrations/`; migration `20261027010822_shared_admin_auth.sql` tạo rate limit đăng nhập quản trị. Test database transactional nằm trong `supabase/tests/`. Các migration multi-team/venue/allocation nêu ở trên đã được áp dụng lên project được liên kết vào ngày 2026-10-27.
4. Nếu chưa có bản ghi đội nào, đăng nhập quản trị và mở `/admin/setup`; thay tên đội mẫu trong SQL bằng tên thật rồi chạy một lần trong Supabase SQL Editor.

Các bảng dữ liệu bật RLS; các role `anon`/`authenticated` không được cấp ghi công khai. RPC công khai cho link thành viên chỉ trả projection đọc của đúng buổi; visitor không có quyền ghi payment. Bucket QR là ảnh công khai chỉ đọc; upload chỉ qua thao tác quản trị phía server.

**Lưu ý quyền truy cập quản trị:** thao tác quản trị phía server dùng service-role key để làm việc với schema hiện có và vì thế vượt qua RLS của PostgreSQL. Mọi trang và Server Action quản trị phải qua kiểm tra session server-side (`requireAdminContext`); key chỉ được tạo trong module server-only và tuyệt đối không gửi xuống client. RLS vẫn chặn quyền trực tiếp từ browser roles, nhưng không phải lớp lọc dữ liệu cho truy vấn service-role. Giới hạn truy cập server, bảo vệ secrets Vercel và không thêm endpoint quản trị không được xác thực.

Supabase Auth email/OTP/OAuth và callback email không được dùng cho đăng nhập quản trị ở kiến trúc này. Cấu hình SMTP không cần thiết.

## Đăng nhập và phân quyền

- `/login`: chế độ `legacy` (mặc định khi chưa nghiệm thu) dùng username/hash từ ENV và cookie HMAC; chế độ `database` dùng username/password hash trong `app_users` và session server-side có thể thu hồi. Không xóa biến legacy trước nghiệm thu.
- `/admin`: điểm vào trang quản trị, chuyển tới dashboard hiện có tại `/`.
- `/system-admin`: chỉ Super Admin database quản lý team, admin, membership, khóa tài khoản/team, reset password, thu hồi session và xem audit log.
- Mọi thao tác nghiệp vụ lấy team từ session/membership đã kiểm tra trên server; không dùng team/role gửi từ client làm nguồn quyền. Các admin cùng team chia sẻ cùng dữ liệu.
- Mọi route quản trị được middleware kiểm tra session; Server Actions kiểm tra lại trong `requireAdminContext`, không dựa vào việc ẩn nút UI.
- `/admin/login` và `/auth/callback` cũ chuyển về `/login`.
- `/share/[token]`: link bearer ngẫu nhiên mạnh, chỉ đọc thông tin đúng buổi và QR; có thể thu hồi. Không cho phép visitor sửa dữ liệu quản trị hoặc tự xác nhận khoản thu.
- Trang share không yêu cầu tài khoản. Chỉ Team Admin đã đăng nhập mới được cập nhật payment; trạng thái payment không đồng nghĩa với xác minh chuyển khoản từ ngân hàng. Hạn chế chia sẻ link và không ghi token vào log ứng dụng.

## Ngân hàng và QR

Sau khi đăng nhập, mở **Cài đặt** để nhập thông tin thật do quản lý cung cấp và tải QR thật PNG/JPEG/WebP tối đa 5 MB hoặc cấu hình URL HTTPS. QR theo địa điểm được quản lý tại `/settings/venues`; QR địa điểm ưu tiên hơn QR đội mặc định. Không có dữ liệu ngân hàng/QR mẫu. Thông tin này được hiển thị cho người có link chia sẻ; không đưa thông tin nhạy cảm khác vào bucket QR.

## Deploy Vercel

Chủ dự án cần tự cấp quyền Git/Vercel/Supabase. Repo này không tự deploy.

1. Import repository vào Vercel, chọn preset Next.js. Dùng build command `yarn build`; không cấu hình static export.
2. Trên **Project Settings → Environment Variables**, đặt các giá trị phù hợp cho Production:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - `SUPABASE_SECRET_KEY` (legacy `SUPABASE_SERVICE_ROLE_KEY` remains supported)
   - `ADMIN_USERNAME`
   - `ADMIN_PASSWORD_HASH`
   - `ADMIN_SESSION_SECRET`
   - `ADMIN_AUTH_MODE=legacy` ban đầu; chỉ đặt `database` sau bootstrap và nghiệm thu auth
3. Các biến cuối cùng không bắt đầu bằng `NEXT_PUBLIC_`. Dùng cùng bộ biến cho Preview chỉ khi bạn thực sự muốn cấp quyền quản trị trên preview; tốt nhất dùng credentials/database riêng.
4. Trước khi deploy code cần migration mới, kiểm tra `npx supabase migration list --linked` và chạy `npx supabase db push` với project-ref production đã xác minh.
5. Deploy; sau khi thay đổi Environment Variables, redeploy để build mới nhận biến. Cấu hình DNS/custom domain và HTTPS trong Vercel.
6. Không cần thêm Supabase Auth Site URL, redirect callback hoặc CORS cho đăng nhập quản trị vì không dùng email/OTP/OAuth và gọi Supabase quản trị từ server.

## Kiểm tra sau deploy

1. Mở `/login`; thử sai credentials và xác nhận không vào được trang quản trị.
2. Đăng nhập đúng; thử mở `/`, `/admin`, `/members`, `/sessions`, `/settings`, `/reports` và đăng xuất. Sau logout, truy cập lại phải bị chuyển về login.
3. Tạo thành viên và buổi đánh; kiểm tra chia VND, phần dư, khoản chi và dữ liệu sau khi tải lại.
4. Tạo link chia sẻ; mở trên thiết bị khác, xác nhận chỉ hiển thị buổi tương ứng và QR; thử gửi yêu cầu ghi payment trực tiếp và xác nhận bị từ chối.
5. Cập nhật payment qua tài khoản Team Admin; xác nhận tổng hợp/audit cập nhật. Thu hồi/tạo lại link rồi thử link cũ.
6. Kiểm tra báo cáo, đóng buổi, QR thật, Storage policy và RLS.
7. Xem Vercel runtime logs và Supabase logs. Không ghi lại hay chia sẻ password, hash, cookie, service-role key hoặc link token.

## Bảo vệ secrets

`.env.local` nằm trong `.gitignore`; `.env.example` không chứa secret. Trước commit kiểm tra `git status` và staged diff. Nếu lộ password, hash, service-role key hoặc session secret, hãy thay/rotate ngay tại nơi cấu hình và redeploy.
