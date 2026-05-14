# Setup GitHub Token

## 🔧 Local Setup

### Bước 1: Copy template file

```bash
cp js/github-config.template.js js/github-config.js
```

### Bước 2: Tạo GitHub Token

1. Vào: https://github.com/settings/tokens?type=beta
2. Click **"Generate new token"**
3. Cấu hình:
   - **Token name**: `solution-way-token`
   - **Expiration**: 90 days hoặc 1 year
   - **Repository access**: Only select `thapMadison/solution-team-the-way`
   - **Permissions**:
     - ✅ **Contents**: `Read and write` (để trigger GitHub Actions)
     - ✅ **Metadata**: `Read-only` (tự động)

### Bước 3: Copy token và paste vào file

Mở `js/github-config.js` (local, đã gitignored) và paste token:

```javascript
token: 'github_pat_11ATLT6LI0...',
```

⚠️ **Lưu ý:** File này đã được gitignore nên sẽ không bị commit lên GitHub!

---

## 🚀 Deployment (GitHub Pages)

⚠️ **Vấn đề:** GitHub Pages không thể dùng environment variables cho client-side code.

### Giải pháp:

**Option 1: Manual deployment**
- Push code lên branch khác (không có token)
- Locally build với token
- Deploy built files

**Option 2: Tách config ra external URL**
- Host config file ở CDN khác
- Load dynamically từ URL

**Option 3: Chấp nhận token bị expose** (Not recommended)
- Commit token lên repo
- GitHub sẽ revoke → tạo token mới
- Vòng lặp tiếp tục...

---

## 📝 Note

File `js/github-config.js` đã được thêm vào `.gitignore`, vì vậy:
- ✅ Local: Hoạt động bình thường với token
- ❌ GitHub Pages: Sẽ thiếu config file → không hoạt động

Để deploy lên GitHub Pages, cần implement một trong các giải pháp trên.
