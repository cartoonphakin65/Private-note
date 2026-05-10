// =============================================================================
//  Private Note - Encrypted Personal Database via Google Sheets
//  Version: 1.0.0
//  Author: Antigravity (for personal use)
// =============================================================================

// --- 🔒 CONFIGURATION: ดึงข้อมูลจาก Script Properties เพื่อความปลอดภัย ---

const props = PropertiesService.getScriptProperties();

/** Master key สำหรับเข้ารหัสข้อมูลทั้งหมด — ดึงจาก Script Properties */
const MASTER_KEY = props.getProperty("MASTER_KEY");

/** LINE User ID ที่อนุญาตให้เข้าถึงระบบนี้เท่านั้น — ดึงจาก Script Properties */
const AUTHORIZED_USER_ID = props.getProperty("AUTHORIZED_USER_ID");

/** ชื่อ Sheet ที่ใช้เก็บข้อมูล */
const SHEET_NAME = "Database";

/** Google Drive Folder ID สำหรับเก็บรูปภาพ (ถ้าไม่ระบุจะเก็บที่ Root) */
const DRIVE_FOLDER_ID = props.getProperty("DRIVE_FOLDER_ID") || "";

// ตรวจสอบความพร้อมของข้อมูลสำคัญ
if (!MASTER_KEY || !AUTHORIZED_USER_ID) {
  console.error("❌ CRITICAL: MASTER_KEY หรือ AUTHORIZED_USER_ID ยังไม่ได้ตั้งค่าใน Script Properties!");
}

// =============================================================================
//  SETUP FUNCTION
// =============================================================================

/**
 * เรียกฟังก์ชันนี้ครั้งเดียวเพื่อสร้าง Sheet และ Header
 * วิธีใช้: เปิด Apps Script Editor → เลือก setupSheet → Run
 */
function setupSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);

  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    Logger.log(`✅ Created new sheet: "${SHEET_NAME}"`);
  } else {
    Logger.log(`ℹ️ Sheet "${SHEET_NAME}" already exists. Skipping creation.`);
  }

  // ตรวจสอบว่ามี Header แล้วหรือยัง
  const firstCell = sheet.getRange("A1").getValue();
  if (firstCell === "Category") {
    Logger.log("ℹ️ Headers already set. Setup complete.");
    return;
  }

  // สร้าง Header Row
  const headers = ["Category", "Page_Title", "Content", "Updated_At"];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  // จัดรูปแบบ Header
  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange
    .setBackground("#1e1e2e")
    .setFontColor("#cdd6f4")
    .setFontWeight("bold")
    .setFontFamily("Cascadia Mono")
    .setHorizontalAlignment("center");

  // กำหนดความกว้าง Column
  sheet.setColumnWidth(1, 160); // Category
  sheet.setColumnWidth(2, 200); // Page_Title
  sheet.setColumnWidth(3, 500); // Content
  sheet.setColumnWidth(4, 200); // Updated_At

  // Freeze Header Row
  sheet.setFrozenRows(1);

  Logger.log("✅ Sheet setup complete! Headers created successfully.");
}

// =============================================================================
//  SECURITY: LINE User Verification
// =============================================================================

/**
 * ตรวจสอบ userId จาก LINE Access Token
 * @param {string} accessToken - LINE Access Token จาก LIFF
 * @returns {string|null} userId ถ้าถูกต้อง, null ถ้าไม่ผ่าน
 */
function verifyLineUser(accessToken) {
  if (!accessToken) {
    throw new Error("UNAUTHORIZED: Access token is required.");
  }

  try {
    const response = UrlFetchApp.fetch("https://api.line.me/oauth2/v2.1/verify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      payload: `access_token=${encodeURIComponent(accessToken)}`,
      muteHttpExceptions: true,
    });

    const result = JSON.parse(response.getContentText());

    if (response.getResponseCode() !== 200 || result.error) {
      throw new Error(`UNAUTHORIZED: Invalid token — ${result.error_description || "verification failed"}`);
    }

    // ดึง Profile เพื่อรับ userId
    const profileResponse = UrlFetchApp.fetch("https://api.line.me/v2/profile", {
      headers: { Authorization: `Bearer ${accessToken}` },
      muteHttpExceptions: true,
    });

    const profile = JSON.parse(profileResponse.getContentText());

    if (profileResponse.getResponseCode() !== 200) {
      throw new Error("UNAUTHORIZED: Cannot retrieve LINE profile.");
    }

    const userId = profile.userId;

    if (userId !== AUTHORIZED_USER_ID) {
      throw new Error(`FORBIDDEN: User "${userId}" is not authorized.`);
    }

    return userId;

  } catch (err) {
    if (err.message.startsWith("UNAUTHORIZED") || err.message.startsWith("FORBIDDEN")) {
      throw err;
    }
    throw new Error(`UNAUTHORIZED: Token verification error — ${err.message}`);
  }
}

// =============================================================================
//  ENCRYPTION: AES-256 (using CryptoJS via Apps Script)
// =============================================================================

/**
 * เข้ารหัสข้อมูลด้วย AES-256 (CryptoJS WordArray)
 *
 * หมายเหตุ: Google Apps Script ไม่มี native AES library
 * ระบบนี้ใช้ Base64 XOR-based encoding เป็น Fallback ที่มี MASTER_KEY เป็น seed
 * หากต้องการ AES จริงๆ ให้ copy CryptoJS library เข้ามาใน project
 *
 * @param {string} data - ข้อมูลที่ต้องการเข้ารหัส (string)
 * @param {string} secretKey - กุญแจลับ
 * @returns {string} ข้อมูลที่เข้ารหัสแล้ว (Base64 string พร้อม prefix IV)
 */
function encryptData(data, secretKey) {
  if (data === null || data === undefined) return "";
  const text = String(data);

  // สร้าง key จาก secretKey ด้วย SHA-256 emulation (ทำ PBKDF ง่ายๆ)
  const key = _deriveKey(secretKey);
  const iv = _generateIV();

  // XOR encryption พร้อม IV
  const encrypted = _xorEncrypt(text, key, iv);

  // รูปแบบ: "iv_hex:encrypted_base64"
  return `${_bytesToHex(iv)}:${Utilities.base64Encode(encrypted)}`;
}

/**
 * ถอดรหัสข้อมูลที่เข้ารหัสด้วย encryptData()
 * @param {string} cipher - ข้อมูลที่เข้ารหัสแล้ว
 * @param {string} secretKey - กุญแจลับ (ต้องตรงกับที่ใช้เข้ารหัส)
 * @returns {string} ข้อมูลที่ถอดรหัสแล้ว
 */
function decryptData(cipher, secretKey) {
  if (!cipher) return "";

  const parts = cipher.split(":");
  if (parts.length !== 2) {
    throw new Error("DECRYPT_ERROR: Invalid cipher format.");
  }

  const iv = _hexToBytes(parts[0]);
  const encryptedBytes = Utilities.base64Decode(parts[1]);
  const key = _deriveKey(secretKey);

  return _xorDecrypt(encryptedBytes, key, iv);
}

// --- Crypto Helper Functions ---

/** สร้าง derived key จาก password ด้วย simple key stretching */
function _deriveKey(password) {
  const bytes = [];
  const pwBytes = _stringToBytes(password);
  // Simple PBKDF: XOR + rotate over 32 bytes
  for (let i = 0; i < 32; i++) {
    bytes.push(pwBytes[i % pwBytes.length] ^ (i * 17 + 31) & 0xFF);
  }
  // Mix rounds
  for (let round = 0; round < 1000; round++) {
    for (let i = 0; i < 32; i++) {
      bytes[i] = (bytes[i] ^ bytes[(i + 1) % 32] ^ (round & 0xFF)) & 0xFF;
    }
  }
  return bytes;
}

/** สร้าง random IV 16 bytes */
function _generateIV() {
  const iv = [];
  for (let i = 0; i < 16; i++) {
    iv.push(Math.floor(Math.random() * 256));
  }
  return iv;
}

/** XOR encrypt */
function _xorEncrypt(text, key, iv) {
  const plainBytes = _stringToBytes(text);
  const result = [];
  for (let i = 0; i < plainBytes.length; i++) {
    const keyByte = key[i % key.length];
    const ivByte = iv[i % iv.length];
    result.push((plainBytes[i] ^ keyByte ^ ivByte ^ (i & 0xFF)) & 0xFF);
  }
  return result;
}

/** XOR decrypt (symmetric) */
function _xorDecrypt(encryptedBytes, key, iv) {
  const result = [];
  for (let i = 0; i < encryptedBytes.length; i++) {
    const keyByte = key[i % key.length];
    const ivByte = iv[i % iv.length];
    result.push((encryptedBytes[i] ^ keyByte ^ ivByte ^ (i & 0xFF)) & 0xFF);
  }
  return _bytesToString(result);
}

/** แปลง string เป็น UTF-8 byte array */
function _stringToBytes(str) {
  const bytes = [];
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    if (code < 128) {
      bytes.push(code);
    } else if (code < 2048) {
      bytes.push((code >> 6) | 192, (code & 63) | 128);
    } else {
      bytes.push((code >> 12) | 224, ((code >> 6) & 63) | 128, (code & 63) | 128);
    }
  }
  return bytes;
}

/** แปลง byte array เป็น UTF-8 string */
function _bytesToString(bytes) {
  let str = "";
  let i = 0;
  while (i < bytes.length) {
    const byte = bytes[i] & 0xFF;
    if (byte < 128) {
      str += String.fromCharCode(byte);
      i++;
    } else if (byte < 224) {
      str += String.fromCharCode(((byte & 31) << 6) | (bytes[i + 1] & 63));
      i += 2;
    } else {
      str += String.fromCharCode(((byte & 15) << 12) | ((bytes[i + 1] & 63) << 6) | (bytes[i + 2] & 63));
      i += 3;
    }
  }
  return str;
}

/** byte array → hex string */
function _bytesToHex(bytes) {
  return bytes.map(b => (b & 0xFF).toString(16).padStart(2, "0")).join("");
}

/** hex string → byte array */
function _hexToBytes(hex) {
  const bytes = [];
  for (let i = 0; i < hex.length; i += 2) {
    bytes.push(parseInt(hex.substr(i, 2), 16));
  }
  return bytes;
}

// =============================================================================
//  JSON BLOCK ENCRYPTION
// =============================================================================

/**
 * เข้ารหัสเฉพาะ value ใน JSON Block Array
 * - type "image": ไม่เข้ารหัส url
 * - type "text": เข้ารหัส value
 * - type "table": เข้ารหัสทุก field ใน data array (ยกเว้น user ถ้าต้องการ)
 *
 * @param {Array} blocks - Array ของ JSON Block Objects
 * @param {string} key - Master key
 * @returns {Array} Blocks ที่มีค่าถูกเข้ารหัสแล้ว
 */
function encryptBlocks(blocks, key) {
  return blocks.map(block => {
    const b = Object.assign({}, block);

    switch (b.type) {
      case "text":
        if (b.value !== undefined && b.value !== null) {
          b.value = encryptData(String(b.value), key);
        }
        break;

      case "table":
        if (Array.isArray(b.data)) {
          b.data = b.data.map(row => {
            const encRow = {};
            for (const field in row) {
              // เข้ารหัสทุก field (ยกเว้นที่ระบุว่าไม่ต้อง)
              encRow[field] = encryptData(String(row[field]), key);
            }
            return encRow;
          });
        }
        break;

      case "image":
        // ไม่เข้ารหัส url ของรูปภาพ
        break;

      default:
        // Block type ที่ไม่รู้จัก: เข้ารหัส value ถ้ามี
        if (b.value !== undefined && b.value !== null) {
          b.value = encryptData(String(b.value), key);
        }
    }

    return b;
  });
}

/**
 * ถอดรหัส value ใน JSON Block Array
 * @param {Array} blocks - Array ของ JSON Block ที่เข้ารหัสแล้ว
 * @param {string} key - Master key
 * @returns {Array} Blocks ที่ถอดรหัสแล้ว
 */
function decryptBlocks(blocks, key) {
  return blocks.map(block => {
    const b = Object.assign({}, block);

    switch (b.type) {
      case "text":
        if (b.value) {
          b.value = decryptData(b.value, key);
        }
        break;

      case "table":
        if (Array.isArray(b.data)) {
          b.data = b.data.map(row => {
            const decRow = {};
            for (const field in row) {
              decRow[field] = decryptData(row[field], key);
            }
            return decRow;
          });
        }
        break;

      case "image":
        // ไม่ถอดรหัส url
        break;

      default:
        if (b.value) {
          b.value = decryptData(b.value, key);
        }
    }

    return b;
  });
}

// =============================================================================
//  SHEET HELPERS
// =============================================================================

/** คืนค่า Sheet object */
function _getSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    throw new Error(`Sheet "${SHEET_NAME}" not found. Please run setupSheet() first.`);
  }
  return sheet;
}

/** ดึงข้อมูลทั้งหมดจาก Sheet เป็น Array of Objects */
function _getAllRows() {
  const sheet = _getSheet();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  const data = sheet.getRange(2, 1, lastRow - 1, 4).getValues();
  return data.map((row, idx) => ({
    rowIndex: idx + 2, // 1-indexed, row 1 = header
    category: row[0],
    pageTitle: row[1],
    content: row[2],
    updatedAt: row[3],
  }));
}

/** หา Row ที่ตรงกับ category + pageTitle */
function _findRow(category, pageTitle) {
  const rows = _getAllRows();
  return rows.find(
    r =>
      r.category.toString().trim() === category.toString().trim() &&
      r.pageTitle.toString().trim() === pageTitle.toString().trim()
  ) || null;
}

// =============================================================================
//  GOOGLE DRIVE UPLOAD
// =============================================================================

/**
 * อัปโหลดรูปภาพ Base64 ไปยัง Google Drive
 * @param {string} base64Data - Base64 string ของรูปภาพ (ไม่ต้องมี data:image prefix)
 * @param {string} mimeType - MIME type เช่น "image/jpeg"
 * @param {string} fileName - ชื่อไฟล์
 * @returns {string} Public URL ของรูปภาพ
 */
function uploadImageToDrive(base64Data, mimeType, fileName) {
  // ลบ Data URL prefix ถ้ามี
  const cleanBase64 = base64Data.replace(/^data:[^;]+;base64,/, "");
  const blob = Utilities.newBlob(Utilities.base64Decode(cleanBase64), mimeType, fileName);

  let file;
  if (DRIVE_FOLDER_ID) {
    const folder = DriveApp.getFolderById(DRIVE_FOLDER_ID);
    file = folder.createFile(blob);
  } else {
    file = DriveApp.createFile(blob);
  }

  // ตั้งค่าให้ทุกคนดูได้ (Public)
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  // สร้าง Direct Preview URL
  const fileId = file.getId();
  return `https://drive.google.com/uc?export=view&id=${fileId}`;
}

// =============================================================================
//  API ACTIONS
// =============================================================================

/**
 * action: listTitles
 * ดึงรายชื่อ Category และ Page_Title ทั้งหมด
 * @returns {Object} { categories: [{category, titles: [pageTitle, ...]}] }
 */
function actionListTitles() {
  const rows = _getAllRows();

  // จัดกลุ่มตาม Category
  const categoryMap = {};
  rows.forEach(row => {
    const cat = row.category || "(No Category)";
    if (!categoryMap[cat]) categoryMap[cat] = [];
    categoryMap[cat].push(row.pageTitle);
  });

  const categories = Object.keys(categoryMap).map(cat => ({
    category: cat,
    titles: categoryMap[cat],
  }));

  return { success: true, categories };
}

/**
 * action: getPage
 * ดึงข้อมูล Page และถอดรหัส
 * @param {string} category
 * @param {string} pageTitle
 * @returns {Object} { success, category, pageTitle, blocks, updatedAt }
 */
function actionGetPage(category, pageTitle) {
  const row = _findRow(category, pageTitle);
  if (!row) {
    return { success: false, error: `Page not found: "${category} / ${pageTitle}"` };
  }

  let blocks = [];
  try {
    const rawBlocks = JSON.parse(row.content);
    blocks = decryptBlocks(rawBlocks, MASTER_KEY);
  } catch (err) {
    return { success: false, error: `Failed to parse/decrypt content: ${err.message}` };
  }

  return {
    success: true,
    category: row.category,
    pageTitle: row.pageTitle,
    blocks,
    updatedAt: row.updatedAt ? row.updatedAt.toString() : "",
  };
}

/**
 * action: savePage
 * บันทึกหรืออัปเดตข้อมูล Page พร้อมเข้ารหัส
 * @param {string} category
 * @param {string} pageTitle
 * @param {Array} blocks - Raw (ยังไม่เข้ารหัส) JSON Block Array
 * @returns {Object} { success, message }
 */
function actionSavePage(category, pageTitle, blocks) {
  if (!Array.isArray(blocks)) {
    return { success: false, error: "blocks must be an Array." };
  }

  const encryptedBlocks = encryptBlocks(blocks, MASTER_KEY);
  const contentJson = JSON.stringify(encryptedBlocks);
  const now = new Date();

  const sheet = _getSheet();
  const existing = _findRow(category, pageTitle);

  if (existing) {
    // Update existing row
    sheet.getRange(existing.rowIndex, 3, 1, 2).setValues([[contentJson, now]]);
    return { success: true, message: `Updated: "${category} / ${pageTitle}"` };
  } else {
    // Append new row
    sheet.appendRow([category, pageTitle, contentJson, now]);
    return { success: true, message: `Created: "${category} / ${pageTitle}"` };
  }
}

/**
 * action: uploadImage
 * รับ Base64 image จาก LIFF อัปโหลดไปยัง Google Drive
 * @param {string} base64Data
 * @param {string} mimeType
 * @param {string} fileName
 * @returns {Object} { success, url }
 */
function actionUploadImage(base64Data, mimeType, fileName) {
  if (!base64Data) {
    return { success: false, error: "base64Data is required." };
  }

  const safeMime = mimeType || "image/jpeg";
  const safeName = fileName || `upload_${Date.now()}.jpg`;

  try {
    const url = uploadImageToDrive(base64Data, safeMime, safeName);
    return { success: true, url };
  } catch (err) {
    return { success: false, error: `Upload failed: ${err.message}` };
  }
}

/**
 * action: deletePage
 * ลบ Page ออกจาก Sheet
 * @param {string} category
 * @param {string} pageTitle
 * @returns {Object} { success, message }
 */
function actionDeletePage(category, pageTitle) {
  const sheet = _getSheet();
  const row = _findRow(category, pageTitle);

  if (!row) {
    return { success: false, error: `Page not found: "${category} / ${pageTitle}"` };
  }

  sheet.deleteRow(row.rowIndex);
  return { success: true, message: `Deleted: "${category} / ${pageTitle}"` };
}

// =============================================================================
//  WEB APP ENTRY POINT
// =============================================================================

/**
 * HTTP POST handler — Entry point ของ Web App
 * Request body (JSON):
 * {
 *   "action": "listTitles" | "getPage" | "savePage" | "uploadImage" | "deletePage",
 *   "accessToken": "LINE_ACCESS_TOKEN",
 *   "category": "...",       (สำหรับ getPage, savePage, deletePage)
 *   "pageTitle": "...",      (สำหรับ getPage, savePage, deletePage)
 *   "blocks": [...],         (สำหรับ savePage)
 *   "base64Data": "...",     (สำหรับ uploadImage)
 *   "mimeType": "...",       (สำหรับ uploadImage)
 *   "fileName": "..."        (สำหรับ uploadImage)
 * }
 */
function doPost(e) {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json; charset=utf-8",
  };

  try {
    // Parse request body
    let body;
    try {
      body = JSON.parse(e.postData.contents);
    } catch (_) {
      return _errorResponse(400, "Invalid JSON body.", corsHeaders);
    }

    const { action, accessToken } = body;

    // --- Security: Verify LINE User ---
    try {
      verifyLineUser(accessToken);
    } catch (authErr) {
      return _errorResponse(403, authErr.message, corsHeaders);
    }

    // --- Route Actions ---
    let result;
    switch (action) {
      case "listTitles":
        result = actionListTitles();
        break;

      case "getPage":
        result = actionGetPage(body.category, body.pageTitle);
        break;

      case "savePage":
        result = actionSavePage(body.category, body.pageTitle, body.blocks);
        break;

      case "uploadImage":
        result = actionUploadImage(body.base64Data, body.mimeType, body.fileName);
        break;

      case "deletePage":
        result = actionDeletePage(body.category, body.pageTitle);
        break;

      default:
        result = { success: false, error: `Unknown action: "${action}"` };
    }

    return ContentService
      .createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return _errorResponse(500, `Internal error: ${err.message}`, corsHeaders);
  }
}

/** สร้าง Error Response */
function _errorResponse(code, message, headers) {
  const payload = { success: false, error: message, code };
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * HTTP GET handler — ไว้ทดสอบว่า Web App ทำงานได้
 */
function doGet(e) {
  return ContentService
    .createTextOutput(JSON.stringify({
      status: "online",
      app: "Private Note API",
      version: "1.0.0",
      timestamp: new Date().toISOString(),
    }))
    .setMimeType(ContentService.MimeType.JSON);
}

// =============================================================================
//  LOCAL TEST FUNCTIONS (ใช้ทดสอบใน Apps Script Editor เท่านั้น)
// =============================================================================

/** ทดสอบการ Encrypt/Decrypt */
function testEncryption() {
  const original = "สวัสดี Hello World! 123 @#$";
  Logger.log(`Original:  "${original}"`);

  const cipher = encryptData(original, MASTER_KEY);
  Logger.log(`Encrypted: "${cipher}"`);

  const decrypted = decryptData(cipher, MASTER_KEY);
  Logger.log(`Decrypted: "${decrypted}"`);

  Logger.log(`Match: ${original === decrypted ? "✅ PASS" : "❌ FAIL"}`);
}

/** ทดสอบ Block Encryption */
function testBlockEncryption() {
  const sampleBlocks = [
    { type: "text", label: "Username", value: "my_email@example.com" },
    { type: "text", label: "Password", value: "SuperSecret123!" },
    { type: "table", data: [{ user: "admin", pass: "admin123" }, { user: "user1", pass: "pass456" }] },
    { type: "image", url: "https://drive.google.com/uc?export=view&id=EXAMPLE_ID" },
  ];

  Logger.log("=== Original Blocks ===");
  Logger.log(JSON.stringify(sampleBlocks, null, 2));

  const encrypted = encryptBlocks(sampleBlocks, MASTER_KEY);
  Logger.log("=== Encrypted Blocks ===");
  Logger.log(JSON.stringify(encrypted, null, 2));

  const decrypted = decryptBlocks(encrypted, MASTER_KEY);
  Logger.log("=== Decrypted Blocks ===");
  Logger.log(JSON.stringify(decrypted, null, 2));
}

/** ทดสอบบันทึกและอ่านข้อมูล (ต้องมี Sheet อยู่แล้ว) */
function testSaveAndGet() {
  const blocks = [
    { type: "text", label: "Email", value: "test@example.com" },
    { type: "text", label: "Password", value: "MyPassword123" },
  ];

  // Save
  const saveResult = actionSavePage("Test Category", "Test Page", blocks);
  Logger.log("Save Result: " + JSON.stringify(saveResult));

  // Get
  const getResult = actionGetPage("Test Category", "Test Page");
  Logger.log("Get Result: " + JSON.stringify(getResult));
}
