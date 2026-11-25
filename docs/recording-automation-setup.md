# Hướng dẫn tự động gắn link recording Google Meet từ Gmail lên LMS (Miễn phí 100%, không cần gói Blaze)

Vì project Firebase `khanh-ielts-v2` đang dùng gói **Spark (miễn phí)** (chưa bật Secret Manager / Cloud Functions Blaze), `scripts/gmail-recording-sync.gs` được cấu hình để **Google Apps Script ghi trực tiếp vào Firestore REST API** bằng quyền chủ sở hữu Google của bạn (`lyquockhanh03@gmail.com`).

---

## Bước 1: Tạo Google Apps Script

1. Truy cập [script.google.com](https://script.google.com) bằng tài khoản `lyquockhanh03@gmail.com`.
2. Bấm **New project** (Dự án mới).
3. Xóa code mặc định trong `Code.gs` và dán toàn bộ nội dung file `scripts/gmail-recording-sync.gs` vào.

---

## Bước 2: Bật quyền Firestore trong `appsscript.json`

1. Ở thanh bên trái, bấm **Project Settings** (biểu tượng bánh răng).
2. Tích chọn **Show "appsscript.json" manifest file in editor**.
3. Quay lại **Editor**, mở file `appsscript.json` và thay bằng:

```json
{
  "timeZone": "Asia/Ho_Chi_Minh",
  "dependencies": {},
  "exceptionLogging": "STACKDRIVER",
  "runtimeVersion": "V8",
  "oauthScopes": [
    "https://www.googleapis.com/auth/gmail.modify",
    "https://www.googleapis.com/auth/datastore"
  ]
}
```

4. Bấm **Save** (Ctrl+S).

---

## Bước 3: Chạy thử & Bật lịch tự động (Trigger)

1. Mở lại `Code.gs`, chọn hàm `syncMeetRecordings` trên thanh công cụ và bấm **Run** để cấp quyền Gmail + Firestore lần đầu.
2. Ở thanh bên trái, chọn **Triggers** (biểu tượng đồng hồ) -> **Add Trigger**:
   - Choose which function to run: `syncMeetRecordings`
   - Select event source: `Time-driven`
   - Select type of time based trigger: `Minutes timer`
   - Select minute interval: `Every 5 minutes` (hoặc `Every 10 minutes`)
3. Bấm **Save**.

Từ nay, mỗi khi Google Meet gửi email báo recording về Gmail, Apps Script sẽ tự động khớp đúng buổi học trong `schedules` và dán `recordingLink` lên web để học sinh xem lại.

### Gắn nhãn kiểm soát trên Gmail
- `LMS-Recording-Synced`: đã khớp và cập nhật lên web thành công.
- `LMS-Recording-Unmatched`: tìm thấy link nhưng chưa khớp được buổi học nào trong khoảng thời gian tương ứng.
