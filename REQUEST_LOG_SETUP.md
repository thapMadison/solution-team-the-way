# Request Log System - Setup Guide

## Tổng quan

Hệ thống **Request Log** giúp tracking và quản lý các yêu cầu hỗ trợ đến Technical Solution Team. Dữ liệu được lưu trữ trực tiếp trong GitHub repository dưới dạng JSON files, không cần database hay backend server riêng.

## Features

- ✅ **Tạo request mới** - Form submit từ PM/Team Lead/các bộ phận khác
- 📋 **Danh sách requests** - Hiển thị tất cả requests với status, priority, type
- 🔍 **Filter & Search** - Lọc theo status, type, priority, và tìm kiếm theo từ khóa
- 👤 **Assignment** - Phân công request cho team members
- 🔄 **Status tracking** - Pending → In Progress → Completed/Cancelled
- 💾 **Auto-save to GitHub** - Mọi thay đổi được commit tự động vào repo
- 📊 **Stats dashboard** - Thống kê tổng số requests, active, completed

## Cấu trúc dữ liệu

```
data/
├── requests/
│   ├── 2026-05/
│   │   ├── request-1715600000000.json
│   │   ├── request-1715603600000.json
│   │   └── ...
│   ├── 2026-06/
│   │   └── request-1717200000000.json
│   └── .gitkeep
└── requests-index.json
```

- **Requests được organize theo tháng** (YYYY-MM folders)
- **Mỗi request là 1 file JSON** với ID là timestamp
- **Index file** chứa metadata của tất cả requests để load nhanh

## Setup Instructions

### Bước 1: Tạo GitHub Personal Access Token (PAT)

1. Đăng nhập GitHub
2. Vào **Settings** → **Developer settings** → **Personal access tokens** → **Fine-grained tokens**
3. Click **"Generate new token"**
4. Cấu hình:
   - **Token name:** `solution-way-requests`
   - **Expiration:** 365 days (hoặc theo nhu cầu)
   - **Repository access:** Chỉ chọn `thapMadison/solution-team-the-way`
   - **Repository permissions:**
     - ✅ **Contents**: Read and Write
     - ❌ (Tất cả permissions khác: No access)
5. Click **Generate token** và **copy token**

⚠️ **Lưu ý:** Token chỉ hiển thị 1 lần, hãy lưu lại an toàn!

### Bước 2: Cập nhật GitHub Config

Mở file [`js/github-config.js`](js/github-config.js) và thay thế placeholder bằng token vừa tạo:

```javascript
const GITHUB_CONFIG = {
  owner: 'thapMadison',
  repo: 'solution-team-the-way',
  token: 'github_pat_REPLACE_WITH_YOUR_TOKEN', // ← Thay bằng token thực
  // ... rest of config
};
```

### Bước 3: Cập nhật danh sách Team Members (Optional)

Trong cùng file `github-config.js`, cập nhật danh sách thành viên để phân công:

```javascript
teamMembers: [
  'Unassigned',
  'Thap Nguyen',          // ← Thay bằng tên thật
  'Team Member 2',        // ← Thay bằng tên thật
  'Team Member 3',
  'Team Member 4',
  'Team Member 5'
]
```

### Bước 4: Commit & Deploy

```bash
git add .
git commit -m "Add Request Log system"
git push origin main
```

GitHub Pages sẽ tự động deploy sau ~1-2 phút.

### Bước 5: Test

1. Truy cập: `https://solution-way.madlab.tech/requests.html`
2. Tạo một test request
3. Kiểm tra GitHub repo xem file đã được tạo trong `data/requests/{month}/`
4. Kiểm tra `data/requests-index.json` đã được update
5. Test filter, search, update status, delete

## Sử dụng

### Tạo Request Mới

1. Vào trang **Request Log** (`requests.html`)
2. Điền form với các thông tin:
   - Người yêu cầu & email
   - Loại request (Technical Support, Proposal, Code Review, etc.)
   - Priority (Low/Medium/High/Critical)
   - Tiêu đề & mô tả chi tiết
   - Deadline & dự án (optional)
3. Click **"Gửi Request"**
4. Request sẽ được lưu vào GitHub và hiển thị trong danh sách

### Quản lý Requests

**Filter:**
- Lọc theo Status (Pending/In Progress/Completed/Cancelled)
- Lọc theo Type (Technical Support, Proposal, etc.)
- Lọc theo Priority (Critical/High/Medium/Low)

**Search:**
- Tìm kiếm theo tiêu đề hoặc tên người yêu cầu

**Update Request:**
1. Click vào request card để mở modal chi tiết
2. Thay đổi Assignee (phân công cho ai)
3. Thay đổi Status (Pending → In Progress → Completed)
4. Click **"Lưu thay đổi"**
5. Changes sẽ được commit vào GitHub

**Delete Request:**
1. Mở request detail modal
2. Click **"Xóa request"**
3. Confirm
4. Request file sẽ bị xóa khỏi GitHub

## Security Considerations

### Token Exposure

⚠️ **GitHub PAT được lưu trong client-side code** → có thể bị expose khi view source.

**Giải pháp bảo mật:**
1. ✅ **Fine-grained PAT** với permissions tối thiểu (chỉ Contents: Read+Write)
2. ✅ **Repository-specific** - chỉ access repo này, không access repos khác
3. ✅ **Limited scope** - chỉ có thể tạo/sửa/xóa files trong `/data/requests/`
4. ✅ **Easy to revoke** - nếu bị compromise, revoke token và tạo mới trong 2 phút

**Worst-case scenario:**
- Kẻ xấu có thể spam requests vào `/data/requests/`
- **Không thể** xóa source code
- **Không thể** access repos khác
- **Không thể** làm hỏng website
- **Dễ dàng cleanup** bằng một Git commit

**Risk level:** Low-Medium (acceptable cho internal tool)

### Alternative Approach (Nếu cần security cao hơn)

Nếu lo ngại về token exposure, có thể migrate sang **GitHub Actions approach:**

```
Form → Trigger GitHub Action (repository_dispatch) → 
Action commits data using GITHUB_TOKEN (in Secrets)
```

Trade-off: 10-30 giây delay thay vì immediate commit.

## Troubleshooting

### Lỗi: "GitHub API error: 404"

**Nguyên nhân:** File `data/requests-index.json` chưa tồn tại trong repo.

**Giải pháp:**
```bash
# Đảm bảo file này đã được commit
git add data/requests-index.json
git commit -m "Initialize requests index"
git push
```

### Lỗi: "GitHub API error: 403"

**Nguyên nhân:** Token không hợp lệ hoặc không có quyền.

**Giải pháp:**
1. Kiểm tra token trong `js/github-config.js` có đúng không
2. Kiểm tra token có quyền Contents: Read+Write
3. Kiểm tra token chưa expire
4. Nếu cần, tạo token mới và update lại

### Requests không hiển thị

**Nguyên nhân:** Có thể do cache browser hoặc file index bị lỗi.

**Giải pháp:**
1. Hard refresh (Ctrl+Shift+R hoặc Cmd+Shift+R)
2. Click nút 🔄 Refresh ở filter bar
3. Check console (F12) xem có lỗi gì không
4. Kiểm tra file `data/requests-index.json` trên GitHub có đúng format không

### Lỗi: "Rate limit exceeded"

**Nguyên nhân:** GitHub API có limit 5000 requests/hour.

**Giải pháp:**
- Đợi 1 giờ để rate limit reset
- Giảm số lần reload/refresh
- Nếu hay bị, cân nhắc implement caching hoặc pagination

## Maintenance

### Hàng tuần
- Review requests mới
- Update status cho requests đang xử lý
- Delete spam requests (nếu có)

### Hàng tháng
- Check GitHub PAT expiration (set calendar reminder)
- Archive requests cũ nếu cần (move sang `/data/archives/`)

### Hàng năm
- Rotate GitHub PAT (tạo mới, update code, revoke cũ)
- Review data structure, optimize nếu cần

## Technical Details

### Stack
- Pure HTML/CSS/JavaScript (no frameworks)
- GitHub REST API for data storage
- GitHub Pages for hosting
- No backend, no database

### Files
- [`requests.html`](requests.html) - Main page
- [`css/requests.css`](css/requests.css) - Styles
- [`js/requests.js`](js/requests.js) - Logic (~600 lines)
- [`js/github-config.js`](js/github-config.js) - Config & API helpers

### Data Flow

**Create Request:**
```
Form → Validate → Create JSON → 
GitHub API (PUT file) → Update index → 
Show success → Reload list
```

**Update Request:**
```
Click card → Load details → Edit → 
GitHub API (PUT with SHA) → Update index → 
Reload list
```

**Delete Request:**
```
Click delete → Confirm → 
GitHub API (DELETE with SHA) → Update index → 
Reload list
```

## Support

Nếu gặp vấn đề:
1. Check browser console (F12) để xem error messages
2. Check file structure trong GitHub repo
3. Verify GitHub token còn valid và có đúng permissions
4. Contact team admin

---

**Version:** 1.0  
**Last Updated:** 2026-05-14  
**Maintained by:** Technical Solution Team
