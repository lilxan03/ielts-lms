# Hướng dẫn tự động gắn link recording Google Meet từ Gmail lên LMS

Quy trình tự động gồm 2 phần:
1. **Firebase Cloud Function (`ingestClassRecording`)** trong `index.js`: nhận link recording, tự động khớp đúng buổi học trong collection `schedules` (ưu tiên tên lớp/topic trong tiêu đề email + gần giờ học nhất trong múi giờ `UTC+7`), rồi cập nhật trường `recordingLink`.
2. **Google Apps Script (`scripts/gmail-recording-sync.gs`)**: chạy ngầm trên Gmail của bạn mỗi 5–10 phút, tìm email báo recording từ Google Meet/Drive và gửi về Cloud Function.

---

## Bước 1: Tạo Secret và Deploy Cloud Function

Mở terminal tại thư mục dự án và chạy:

```bash
npx firebase functions:secrets:set RECORDING_WEBHOOK_SECRET
```
Nhập một chuỗi bí mật bất kỳ (ví dụ một chuỗi ngẫu nhiên dài 32 ký tự) và ghi nhớ để dán vào Apps Script ở Bước 2.

Sau đó deploy function:

```bash
npx firebase deploy --only functions:ingestClassRecording
```

Sau khi deploy xong, Firebase sẽ in ra URL của function (dạng `https://ingestclassrecording-xxxx-uc.a.run.app` hoặc `https://us-central1-<project-id>.cloudfunctions.net/ingestClassRecording`). Copy URL này.

---

## Bước 2: Cài đặt Google Apps Script trên Gmail

1. Truy cập [script.google.com](https://script.google.com) bằng đúng tài khoản Gmail nhận thông báo recording.
2. Bấm **New project** (Dự án mới), xóa code mặc định và dán toàn bộ nội dung file `scripts/gmail-recording-sync.gs` vào.
3. Vào **Project Settings** (biểu tượng bánh răng bên trái) -> kéo xuống **Script Properties** -> bấm **Add script property** để thêm 2 dòng:
   - `WEBHOOK_URL`: URL của `ingestClassRecording` ở Bước 1
   - `WEBHOOK_SECRET`: chuỗi bí mật `RECORDING_WEBHOOK_SECRET` ở Bước 1
4. Quay lại tab **Editor**, chọn hàm `syncMeetRecordings` trên thanh công cụ và bấm **Run** lần đầu để cấp quyền đọc Gmail và gắn nhãn (label).

---

## Bước 3: Bật lịch chạy tự động (Trigger)

1. Ở thanh bên trái trong Apps Script, chọn **Triggers** (biểu tượng đồng hồ).
2. Bấm **Add Trigger** (góc dưới phải):
   - Choose which function to run: `syncMeetRecordings`
   - Select event source: `Time-driven`
   - Select type of time based trigger: `Minutes timer`
   - Select minute interval: `Every 5 minutes` (hoặc `Every 10 minutes`)
3. Bấm **Save**.

Từ nay, mỗi khi dạy xong và Google Meet gửi email báo recording về Gmail, hệ thống sẽ tự động lấy link dán vào đúng buổi học trên web để học sinh xem lại.

### Gắn nhãn kiểm soát trên Gmail
- `LMS-Recording-Synced`: đã khớp và cập nhật lên web thành công.
- `LMS-Recording-Unmatched`: tìm thấy link nhưng chưa khớp được buổi học nào trong khoảng thời gian tương ứng (bạn có thể kiểm tra lại giờ/ngày buổi học trên web).
