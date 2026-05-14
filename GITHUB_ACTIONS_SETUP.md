# GitHub Actions Setup Guide

## 🎯 Tổng quan

Hệ thống Request Log giờ sử dụng **GitHub Actions** thay vì commit trực tiếp từ browser. Điều này giải quyết vấn đề GitHub tự động revoke token khi detect trong source code.

## 🏗️ Kiến trúc mới

### **Luồng dữ liệu:**

```
┌─────────────┐
│   Browser   │
│   (Form)    │
└──────┬──────┘
       │ 1. Trigger repository_dispatch
       ▼
┌─────────────────┐
│ GitHub Actions  │
│  (Workflows)    │
└──────┬──────────┘
       │ 2. Create/Update/Delete files
       │    using GITHUB_TOKEN (secure)
       ▼
┌─────────────────┐
│   Repository    │
│  (data/ files)  │
└──────┬──────────┘
       │ 3. Read data (unauthenticated)
       ▼
┌─────────────┐
│   Browser   │
│  (Display)  │
└─────────────┘
```

### **Workflows created:**

1. **handle-request.yml** - Tạo request mới
2. **update-request.yml** - Cập nhật status & assignee
3. **delete-request.yml** - Xóa request

## 🔑 Token Setup (QUAN TRỌNG!)

### **Bước 1: Tạo GitHub Fine-grained Token**

1. Vào: https://github.com/settings/tokens?type=beta
2. Click **"Generate new token"**

### **Bước 2: Cấu hình token**

**Repository access:**
- ⭕ **Only select repositories**
- ✅ Chọn: `thapMadison/solution-team-the-way`

**Repository permissions:** (CHỈ CẦN 1 PERMISSION!)
- ✅ **Actions**: `Read and write` 
- ❌ **Contents**: `No access` (không cần!)
- ❌ Tất cả khác: `No access`

**Metadata:**
- ✅ Tự động check `Read-only` (bắt buộc)

**Token settings:**
- **Token name**: `solution-way-actions-trigger`
- **Expiration**: `90 days` hoặc `1 year`

### **Bước 3: Generate & Copy**

1. Click **"Generate token"**
2. Copy token (dạng: `github_pat_11...`)
3. ⚠️ **Token chỉ hiện 1 lần!** Lưu ngay vào notepad

### **Bước 4: Paste vào code**

Mở file `js/github-config.js` và paste token:

```javascript
token: 'github_pat_11ATLT6LI0...', // Paste token ở đây
```

### **Bước 5: Commit & Push**

```bash
git add .
git commit -m "Update to GitHub Actions architecture"
git push origin main
```

## ✅ Permissions Checklist

Đảm bảo token có **ĐÚNG** permissions:

- ✅ **Actions**: Read and Write
- ❌ **Contents**: No access (KHÔNG CẦN!)
- ✅ **Metadata**: Read-only (tự động)
- ❌ **Issues, Pull Requests, etc.**: No access

**Lý do:**
- Token này chỉ để **trigger workflows**
- Workflows sẽ dùng `GITHUB_TOKEN` (built-in) để commit
- `GITHUB_TOKEN` không bị GitHub scan/revoke

## 🚀 Cách hoạt động

### **Tạo request mới:**

1. User điền form → Click "Gửi Request"
2. JavaScript gọi `repository_dispatch` API → Trigger workflow
3. Workflow `handle-request.yml` chạy:
   - Tạo file JSON trong `data/requests/{month}/`
   - Cập nhật `data/requests-index.json`
   - Commit với `GITHUB_TOKEN`
4. GitHub Pages tự động deploy
5. Browser reload sau ~30 giây → Hiện request mới

### **Update request:**

1. User click request → Modal → Thay đổi status/assignee → Save
2. JavaScript trigger `update-request` workflow
3. Workflow cập nhật file và index
4. Reload sau ~30 giây → Thấy thay đổi

### **Delete request:**

1. User click Delete → Confirm
2. JavaScript trigger `delete-request` workflow
3. Workflow xóa file và cập nhật index
4. Reload sau ~30 giây → Request biến mất

## ⏱️ Timing

- **Immediate**: Trigger workflow (~1-2 giây)
- **Workflow execution**: 10-30 giây
- **GitHub Pages deploy**: 1-2 phút
- **Total**: ~2-3 phút để thấy thay đổi

**Auto-reload:**
- JavaScript tự động reload sau 30 giây
- Nếu chưa thấy, đợi thêm và click 🔄 Refresh

## 🔒 Security

### **Tại sao an toàn hơn?**

| Cách cũ | Cách mới (GitHub Actions) |
|---------|---------------------------|
| Token có quyền Contents Write | Token chỉ có quyền Actions |
| Token commit từ browser | `GITHUB_TOKEN` commit từ workflow |
| Token bị GitHub scan → revoke | Token không bị scan (không commit files) |
| Risk: High | Risk: Low |

### **Token exposure:**

- ⚠️ Token vẫn visible trong source code
- ✅ Nhưng token **không có quyền commit/delete files**
- ✅ Chỉ có quyền trigger workflows
- ✅ Worst case: Spam trigger workflows (GitHub có rate limit)

### **GITHUB_TOKEN:**

- ✅ Được GitHub tự động tạo cho mỗi workflow run
- ✅ Chỉ tồn tại trong thời gian workflow chạy
- ✅ Có full quyền với repo (nhưng an toàn vì server-side)
- ✅ Không bao giờ expose ra ngoài

## 🧪 Testing

### **Test workflow locally:**

Không thể test workflow locally, nhưng có thể:

1. Commit workflows lên GitHub
2. Trigger manually trong Actions tab
3. Hoặc tạo test request từ form

### **Debug workflows:**

1. Vào GitHub → Actions tab
2. Click vào workflow run
3. Xem logs từng step
4. Check lỗi nếu có

### **Common issues:**

**Workflow không chạy:**
- ✅ Check token có quyền Actions?
- ✅ Check workflows đã được push lên GitHub?
- ✅ Check event type đúng không? (`new-request`, `update-request`, `delete-request`)

**Request không xuất hiện:**
- ⏱️ Đợi đủ 2-3 phút
- 🔄 Hard refresh browser (Ctrl+Shift+R)
- 👀 Check Actions tab xem workflow có chạy thành công không

## 📊 Monitoring

### **Xem workflow runs:**

1. Vào: https://github.com/thapMadison/solution-team-the-way/actions
2. Thấy list tất cả workflow runs
3. Click vào để xem chi tiết logs

### **Filter by workflow:**

- **New Request** → `Handle New Request`
- **Update** → `Update Request`
- **Delete** → `Delete Request`

## 🔧 Maintenance

### **Khi token hết hạn:**

1. Tạo token mới (same permissions)
2. Update `js/github-config.js`
3. Commit & push
4. Đợi GitHub Pages deploy (~2 phút)

### **Update workflows:**

Nếu cần sửa workflows (`.github/workflows/*.yml`):

1. Edit file locally
2. Commit & push
3. Test bằng cách tạo request mới
4. Check Actions tab để verify

## 🆚 So sánh với cách cũ

| Feature | Direct API | GitHub Actions |
|---------|-----------|----------------|
| **Speed** | Instant | ~30 giây delay |
| **Security** | Token bị revoke | Token an toàn |
| **Complexity** | Đơn giản | Hơi phức tạp |
| **Reliability** | Không hoạt động | ✅ Hoạt động |
| **Cost** | Free | Free |
| **Best for** | ❌ Không dùng được | ✅ Production |

## 📚 References

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Repository Dispatch Event](https://docs.github.com/en/rest/repos/repos#create-a-repository-dispatch-event)
- [Fine-grained PAT](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens#creating-a-fine-grained-personal-access-token)
- [GITHUB_TOKEN](https://docs.github.com/en/actions/security-guides/automatic-token-authentication)

---

**Version:** 2.0 (GitHub Actions)  
**Updated:** 2026-05-14  
**Maintained by:** Technical Solution Team
