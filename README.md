# Private Note — Encrypted Personal Database

ระบบจัดการฐานข้อมูลส่วนตัวแบบเข้ารหัส ผ่าน Google Sheets + Google Apps Script + LINE LIFF

---

## ขั้นตอนการติดตั้ง

### 1. สร้างโปรเจกต์ Google Apps Script
1. ไปที่ [script.google.com](https://script.google.com)
2. คลิก **New Project**
3. ลบโค้ดเดิมออกทั้งหมด แล้ว **copy `Code.gs`** ทั้งหมดวางลงไป
4. บันทึกไฟล์ (Ctrl+S)

---

### 2. ตั้งค่าความปลอดภัย (Script Properties)

แทนที่จะแก้ในโค้ด เราจะเก็บความลับไว้ในระบบของ Google:
1. ในหน้า Apps Script Editor → คลิกไอคอน **Project Settings** (รูปเฟือง ⚙️)
2. เลื่อนลงไปที่ **Script Properties** → กด **Add script property**
3. เพิ่มข้อมูลดังนี้:
   - **Property:** `MASTER_KEY` | **Value:** `(รหัสลับที่คุณตั้งเอง)`
   - **Property:** `AUTHORIZED_USER_ID` | **Value:** `(LINE User ID ของคุณ)`
   - (Optional) **Property:** `DRIVE_FOLDER_ID` | **Value:** `(ID ของโฟลเดอร์เก็บรูป)`

> ⚠️ **คำเตือน**: ถ้าลืม `MASTER_KEY` จะไม่สามารถกู้คืนข้อมูลใน Sheet ได้เลย!

---

### 3. รัน setupSheet() เพื่อสร้าง Sheet
1. ใน Apps Script Editor → คลิก **dropdown** บน Toolbar เลือก `setupSheet`
2. คลิกปุ่ม **Run** (▶)
3. ระบบจะสร้าง Sheet ชื่อ "Database" พร้อม Header โดยอัตโนมัติ

---

### 4. เปิดใช้งาน Google Drive API
1. ใน Apps Script Editor → คลิกเมนู **Services** (ไอคอน +)
2. ค้นหา **Drive API** → คลิก **Add**

---

### 5. Deploy เป็น Web App
1. คลิก **Deploy** → **New deployment**
2. เลือก Type: **Web app**
3. ตั้งค่าดังนี้:
   - **Execute as**: Me
   - **Who has access**: Anyone
4. คลิก **Deploy** → คัดลอก **Web App URL** เก็บไว้

---

## API Reference

### Request Format
```
POST {WEB_APP_URL}
Content-Type: application/json
```

### Common Body Fields
| Field | Type | Description |
|-------|------|-------------|
| `action` | string | ชื่อ Action ที่ต้องการ |
| `accessToken` | string | LINE Access Token จาก `liff.getAccessToken()` |

---

### `listTitles` — ดึงรายการทั้งหมด
```json
// Request
{ "action": "listTitles", "accessToken": "..." }

// Response
{
  "success": true,
  "categories": [
    { "category": "Pass Birthday", "titles": ["EA", "Facebook"] },
    { "category": "สูตรยำ", "titles": ["น้ำยำสูตร 1"] }
  ]
}
```

---

### `getPage` — ดึงข้อมูลหน้า (ถอดรหัสอัตโนมัติ)
```json
// Request
{
  "action": "getPage",
  "accessToken": "...",
  "category": "Pass Birthday",
  "pageTitle": "EA"
}

// Response
{
  "success": true,
  "category": "Pass Birthday",
  "pageTitle": "EA",
  "blocks": [
    { "type": "text", "label": "Email", "value": "my@email.com" },
    { "type": "text", "label": "Password", "value": "MySecret123" }
  ],
  "updatedAt": "Fri May 09 2025 21:00:00 GMT+0700"
}
```

---

### `savePage` — บันทึก/อัปเดตหน้า
```json
// Request
{
  "action": "savePage",
  "accessToken": "...",
  "category": "สูตรยำ",
  "pageTitle": "น้ำยำสูตร 1",
  "blocks": [
    { "type": "text", "label": "วัตถุดิบ", "value": "มะนาว 2 ลูก, น้ำปลา 3 ช้อน" },
    { "type": "image", "url": "https://drive.google.com/uc?export=view&id=..." }
  ]
}

// Response
{ "success": true, "message": "Created: \"สูตรยำ / น้ำยำสูตร 1\"" }
```

---

### `uploadImage` — อัปโหลดรูปภาพ
```json
// Request
{
  "action": "uploadImage",
  "accessToken": "...",
  "base64Data": "data:image/jpeg;base64,/9j/4AAQ...",
  "mimeType": "image/jpeg",
  "fileName": "my_image.jpg"
}

// Response
{ "success": true, "url": "https://drive.google.com/uc?export=view&id=..." }
```

---

### `deletePage` — ลบหน้า
```json
// Request
{
  "action": "deletePage",
  "accessToken": "...",
  "category": "Pass Birthday",
  "pageTitle": "OldAccount"
}

// Response
{ "success": true, "message": "Deleted: \"Pass Birthday / OldAccount\"" }
```

---

## JSON Block Schema

| type | fields | encrypted? |
|------|--------|-----------|
| `text` | `label`, `value` | `value` ✅ |
| `table` | `data: [{field: value}]` | ทุก field ใน data ✅ |
| `image` | `url` | ❌ (URL ไม่เข้ารหัส) |

---

## ตัวอย่างการเรียกใช้จาก LIFF

```javascript
const API_URL = "https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec";

async function getPage(category, pageTitle) {
  const token = liff.getAccessToken();
  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "getPage",
      accessToken: token,
      category,
      pageTitle,
    }),
  });
  return await res.json();
}
```

---

## ทดสอบใน Apps Script Editor

| Function | วัตถุประสงค์ |
|----------|-------------|
| `testEncryption()` | ทดสอบ Encrypt/Decrypt ข้อความ |
| `testBlockEncryption()` | ทดสอบ Block Encryption ทุกประเภท |
| `testSaveAndGet()` | ทดสอบบันทึกและอ่านข้อมูลจริงใน Sheet |
