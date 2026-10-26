# RallyTeam — Badminton Team Manager

Ứng dụng quản lý đội cầu lông dùng Next.js App Router, TypeScript, Tailwind CSS, Supabase và giao diện tiếng Việt. Thành viên không cần tài khoản hoặc PIN; chỉ quản trị viên đăng nhập bằng magic link. Trạng thái thanh toán do người có link chia sẻ xác nhận thủ công, không phải đối soát ngân hàng.

## Yêu cầu môi trường

- Node.js 18.17 trở lên.
- Yarn Classic 1.x (repo có `yarn.lock`).
- Một project Supabase đã tạo.
- Tài khoản Vercel/Git để deploy là tùy chọn và cần do chủ dự án tự cấp quyền.

## Cài package và chạy local

```bash
yarn install --frozen-lockfile
Copy-Item .env.example .env.local
```

Điền giá trị Supabase vào `.env.local`, sau đó chạy:

```bash
yarn dev
```

Mở `http://localhost:3000`. Kiểm tra chất lượng bằng:

```bash
yarn lint
yarn typecheck
yarn test
yarn build
```

Không đưa `.env.local` lên Git. `.env.example` chỉ chứa tên biến và giá trị mẫu không bí mật.

## Cấu hình Supabase

1. Tạo project và lấy Project URL cùng **publishable key** từ Supabase Dashboard → **Project Settings → API Keys**.
2. Điền các biến sau trong `.env.local`:

   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<publishable-key>
   NEXT_PUBLIC_SITE_URL=http://localhost:3000
   ```

3. Tạo user quản trị trong Dashboard → **Authentication → Users**. Tắt đăng ký công khai nếu không cần.
4. Cài Supabase CLI (ví dụ `npx supabase --help` để xem cách dùng), đăng nhập và liên kết đúng project:

   ```bash
   npx supabase login
   npx supabase link --project-ref <project-ref>
   npx supabase migration list --linked
   npx supabase db push
   npx supabase migration list --linked
   ```

   Trước khi `db push`, kiểm tra project-ref/link đang trỏ đến đúng project. Đọc danh sách migration pending và backup dữ liệu production theo quy trình của chủ dự án.
5. Sau khi migrations áp dụng, đăng nhập quản trị viên và mở `/admin/setup`. Sao chép SQL bootstrap do trang tạo ra, chạy trong Supabase SQL Editor để liên kết user quản trị với team.

### Migration, RLS và Storage

- Migration trong `supabase/migrations/` tạo các bảng, quyền và trigger cần thiết. RLS được bật trên các bảng dữ liệu; quyền quản trị được giới hạn theo `team_settings.admin_user_id`.
- Client browser chỉ sử dụng Supabase URL và publishable key. Server actions dùng phiên quản trị và RLS; không cấu hình service-role/secret key cho ứng dụng.
- Migration tạo Storage bucket `team-bank-qr` công khai chỉ đọc ảnh QR; giới hạn PNG/JPEG/WebP tối đa 5 MB. Policy chỉ cho admin đúng team upload/xóa. Không upload tài liệu nhạy cảm vào bucket này.
- Các RPC public là endpoint hẹp cho link bearer: đọc projection của buổi hoặc tick/bỏ tick payment tương ứng; không có quyền ghi công khai trực tiếp lên bảng.
- Sau `db push`, kiểm tra `npx supabase migration list --linked` và xác nhận các migration trong repo đã được áp dụng. Test transactional trong `supabase/tests/` chỉ chạy được khi có CLI/DB credentials tương ứng; fixture rollback dữ liệu.

## Đăng nhập và URL callback/domain

Ứng dụng gửi magic link với redirect URI:

```text
<NEXT_PUBLIC_SITE_URL>/auth/callback?next=/
```

Trong Supabase Dashboard → **Authentication → URL Configuration**:

- **Site URL**: URL canonical production, ví dụ `https://app.example.com`.
- **Redirect URLs**: thêm chính xác `https://app.example.com/auth/callback` và URL local `http://localhost:3000/auth/callback`. Nếu cho phép preview deployments, thêm từng domain preview cần dùng; hạn chế wildcard theo chính sách dự án.
- `NEXT_PUBLIC_SITE_URL` của môi trường production phải là domain production HTTPS; với local dùng `http://localhost:3000`.

Không có cấu hình CORS tùy chỉnh trong ứng dụng. Trình duyệt gọi ứng dụng cùng origin; các thao tác Supabase quản trị/public RPC được gọi từ server. Nếu đổi cách gọi để browser gọi trực tiếp Supabase, hãy đánh giá lại CORS và policy trước khi mở rộng.

## Nhập thông tin ngân hàng và QR

Sau khi đăng nhập bằng tài khoản quản trị:

1. Mở **Cài đặt**, nhập thông tin tài khoản ngân hàng thật do chủ đội cung cấp.
2. Upload ảnh QR thật dạng PNG/JPEG/WebP (tối đa 5 MB) hoặc nhập URL HTTPS của ảnh đã có.
3. Ảnh và dữ liệu tài khoản được hiển thị công khai cùng link chia sẻ. Chỉ dùng thông tin được phép chia sẻ; ứng dụng không tạo QR/ngân hàng giả và không giả định QR chứa số tiền riêng từng người.
4. Mở chi tiết buổi đánh để tạo link mới. Token chỉ hiển thị ngay sau khi tạo; sao chép và gửi link an toàn. Thu hồi link sẽ vô hiệu hóa quyền xem/xác nhận của link đó.

## Tính năng chính và lưu ý nghiệp vụ

- Tạo/chỉnh sửa buổi đánh, quản lý thành viên, nhập khoản chi và lưu trong Supabase.
- Database tính khoản phải trả bằng VND số nguyên, chia đều người tham gia; phần dư được phân bổ ổn định theo UUID thành viên.
- Thay đổi chi phí/người tham gia giữ nguyên khoản đã xác nhận và trạng thái payment; khoản đã thu vượt mức mới không tự động hoàn.
- Bất kỳ ai có link chia sẻ hợp lệ đều xem dữ liệu công khai trong phạm vi buổi đó và có thể tick/bỏ tick. Link không xác minh danh tính hoặc giao dịch ngân hàng; thao tác được ghi audit.
- Trang báo cáo lọc tháng/ngày/trạng thái, tổng hợp tiền và hiển thị chi tiết khoản chi, payment, lịch sử.
- Đóng buổi chuyển trạng thái sang hoàn thành, vẫn giữ thành viên, chi phí và lịch sử.

## Deploy production lên Vercel

Không deploy tự động từ repo này. Chủ dự án cần tự đăng nhập và cấp quyền cho Vercel, Git provider và Supabase.

1. Đưa repo lên Git provider được Vercel truy cập; trong Vercel chọn **Add New → Project**, import repo.
2. Dùng preset **Next.js**. Build command mặc định `yarn build`; install command `yarn install`. Không cấu hình static export.
3. Trong Vercel → **Project Settings → Environment Variables**, khai báo ba biến cho môi trường cần deploy:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - `NEXT_PUBLIC_SITE_URL` (domain HTTPS canonical cho production)
4. Chỉ dùng publishable key ở biến public. Không thêm service role key, database password hoặc access token vào `NEXT_PUBLIC_*`, code, build log hay Git.
5. Trước deploy lần đầu, chạy các migration lên đúng Supabase production project bằng Supabase CLI, xác nhận migration history, cấu hình Auth URL/Redirect URLs và bootstrap admin như hướng dẫn trên. Không chạy lại SQL bootstrap trên team đã cấu hình.
6. Deploy từ Vercel. Khi thêm custom domain, hoàn tất xác minh DNS/HTTPS ở Vercel; cập nhật `NEXT_PUBLIC_SITE_URL` thành domain đó trong Production environment, redeploy, rồi cập nhật Supabase Site URL/Redirect URLs.
7. Preview deployment dùng URL riêng. Chỉ bật đăng nhập preview nếu đã khai báo `NEXT_PUBLIC_SITE_URL` phù hợp và cho phép callback URL preview tương ứng trong Supabase; không mở wildcard rộng nếu không cần.

## Kiểm tra sau deploy

1. Kiểm tra trang đăng nhập quản trị; yêu cầu magic link và xác nhận URL trong email trỏ về `https://<domain>/auth/callback`.
2. Hoàn tất callback, mở dashboard; thử tạo và tải lại thành viên/buổi đánh để xác nhận dữ liệu được lưu.
3. Tạo buổi thử với khoản chi và người tham gia; kiểm tra tổng phân bổ bằng đúng tổng chi, bao gồm trường hợp có phần dư.
4. Cấu hình QR thật và xác nhận ảnh hiển thị đúng trên desktop/mobile.
5. Tạo link chia sẻ; mở trên trình duyệt/điện thoại khác, kiểm tra dữ liệu đúng phạm vi và tick rồi bỏ tick payment. Kiểm tra audit history và trạng thái trên thiết bị ban đầu.
6. Kiểm tra báo cáo lọc ngày/tháng/trạng thái, số đã xác nhận/còn thiếu và lịch sử từng buổi.
7. Thu hồi link, xác nhận link cũ không còn xem hoặc thay đổi thanh toán được.
8. Xác nhận truy cập admin khi chưa đăng nhập bị chuyển về login; kiểm tra RLS, Storage policy và không có service-role/secret key trong client bundle hoặc Git.
9. Xem Vercel deployment/runtime logs và Supabase Auth/API/Database logs để phát hiện lỗi. Không ghi hoặc chia sẻ token link, cookie hay credentials trong báo cáo.

## Checklist nghiệm thu

- [ ] Tạo buổi đánh.
- [ ] Thêm thành viên.
- [ ] Kiểm tra chia tiền và phần dư.
- [ ] Mở link chia sẻ trên điện thoại/trình duyệt khác.
- [ ] Xem QR thật đã cấu hình.
- [ ] Tick và bỏ tick thanh toán.
- [ ] Kiểm tra báo cáo và lịch sử thanh toán.
- [ ] Thu hồi link và xác nhận link cũ bị vô hiệu hóa.
- [ ] Kiểm tra quyền truy cập admin, RLS/Storage và lịch sử thao tác.

## Môi trường và secrets

`.env.local` bị Git ignore. Không commit `.env`, `.env.local`, service-role/secret key, mật khẩu database, Supabase access token, magic-link/token chia sẻ hoặc cookie. Nếu nghi ngờ bí mật đã bị lộ, thu hồi/rotate tại nhà cung cấp tương ứng.
