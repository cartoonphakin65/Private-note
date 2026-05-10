const C = {
  LIFF_ID: "2010026548-URmUkcwk",
  API_URL: API_URL,
};

const S = {
  view: "loading",
  categories: [],
  activeCategory: null,
  pageData: null,
  editData: null,
  token: null,
};

const app = document.getElementById("app");
const toastRoot = document.getElementById("toast-root");
const modalRoot = document.getElementById("modal-root");

/* ── API ── */
async function api(action, params = {}) {
  const body = { action, accessToken: S.token, ...params };
  const res = await fetch(C.API_URL, {
    method: "POST",
    body: JSON.stringify(body),
    redirect: "follow",
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error || "API error");
  return data;
}

/* ── Toast ── */
function toast(msg, type = "info") {
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  const icons = { success: "✓", error: "✕", info: "ℹ" };
  el.innerHTML = `<span>${icons[type]}</span><span>${msg}</span>`;
  if (!toastRoot.querySelector(".toast-container")) {
    const c = document.createElement("div");
    c.className = "toast-container";
    toastRoot.appendChild(c);
  }
  toastRoot.querySelector(".toast-container").appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

/* ── Modal ── */
function confirm(title, desc) {
  return new Promise((resolve) => {
    const ov = document.createElement("div");
    ov.className = "modal-overlay";
    ov.innerHTML = `
      <div class="modal-box">
        <div class="modal-title">${title}</div>
        <div class="modal-desc">${desc}</div>
        <div class="modal-actions">
          <button class="btn btn-ghost btn-sm" id="m-cancel">ยกเลิก</button>
          <button class="btn btn-danger btn-sm" id="m-ok">ยืนยัน</button>
        </div>
      </div>`;
    modalRoot.appendChild(ov);
    ov.querySelector("#m-cancel").onclick = () => { ov.remove(); resolve(false); };
    ov.querySelector("#m-ok").onclick    = () => { ov.remove(); resolve(true);  };
    ov.onclick = (e) => { if (e.target === ov) { ov.remove(); resolve(false); } };
  });
}

/* ── Navigate ── */
function go(view, params = {}) {
  console.log("Navigating to:", view, params);
  Object.assign(S, params);
  S.view = view;
  render();
}

/* ── Render ── */
function render() {
  const screens = { loading: renderLoading, list: renderList, view: renderView, edit: renderEdit };
  (screens[S.view] || renderLoading)();
}

function renderLoading() {
  const ls = document.getElementById("loading-screen");
  if (ls) ls.style.display = "";
}

/* ── LIST VIEW ── */
function renderList() {
  const ls = document.getElementById("loading-screen");
  if (ls) ls.style.display = "none";
  const cats = S.categories;
  if (!S.activeCategory && cats.length) S.activeCategory = cats[0].category;
  const active = cats.find(c => c.category === S.activeCategory);
  const titles = active ? active.titles : [];

  const catIcons = ["📁","📂","🗂️","📋","📌"];
  const sidebarCats = cats.map((c, i) => `
    <button class="sidebar-cat-btn ${c.category === S.activeCategory ? "active" : ""}" onclick="setCategory('${esc(c.category)}')">
      <span class="sidebar-cat-icon">${catIcons[i % catIcons.length]}</span>
      <span>${esc(c.category)}</span>
      <span class="sidebar-cat-count">${c.titles.length}</span>
    </button>`).join("");

  const chips = cats.map(c => `
    <button class="cat-chip ${c.category === S.activeCategory ? "active" : ""}" onclick="setCategory('${esc(c.category)}')">${esc(c.category)}</button>`).join("");

  const cards = titles.length
    ? titles.map(t => `
      <div class="page-card" onclick="loadPage('${esc(S.activeCategory)}','${esc(t)}')">
        <div class="page-card-icon">🔐</div>
        <div class="page-card-title">${esc(t)}</div>
        <div class="page-card-meta"><span>🏷️ ${esc(S.activeCategory)}</span></div>
      </div>`).join("")
    : `<div class="empty-state" style="grid-column:1/-1">
        <div class="empty-state-icon">📭</div>
        <div class="empty-state-title">ยังไม่มีหน้าในหมวดนี้</div>
        <div class="empty-state-sub">กด + เพื่อเพิ่มหน้าใหม่</div>
       </div>`;

  app.innerHTML = `
    <div class="app-wrapper">
      <nav class="sidebar">
        <div class="sidebar-header">
          <div class="sidebar-brand">
            <svg width="36" height="36" viewBox="0 0 48 48" fill="none">
              <rect width="48" height="48" rx="14" fill="#6366f1"/>
              <path d="M14 16h20M14 24h14M14 32h18" stroke="white" stroke-width="2.5" stroke-linecap="round"/>
            </svg>
            <div><div class="sidebar-brand-text">Private Note</div>
            <div class="sidebar-brand-sub">ระบบจดบันทึกส่วนตัว</div></div>
          </div>
        </div>
        <div class="sidebar-nav">
          <div class="sidebar-section-label">หมวดหมู่</div>
          ${sidebarCats}
        </div>
        <div class="sidebar-footer">
          <button class="sidebar-add-btn" onclick="go('edit',{editData:{category:S.activeCategory||'',pageTitle:'',blocks:[],isNew:true}})">
            <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>
            เพิ่มหน้าใหม่
          </button>
        </div>
      </nav>
      <div class="main-area">
        <div class="mobile-header">
          <div class="mobile-header-title">Private Note</div>
          <button class="btn btn-primary btn-sm" onclick="go('edit',{editData:{category:S.activeCategory||'',pageTitle:'',blocks:[],isNew:true}})">+ เพิ่ม</button>
        </div>
        <div class="cat-chips">${chips}</div>
        <div class="content-area">
          <div class="section-heading">${esc(S.activeCategory || "เลือกหมวดหมู่")}</div>
          <div class="page-grid">${cards}</div>
        </div>
      </div>
    </div>
    <button class="fab" id="fab-add" onclick="go('edit',{editData:{category:S.activeCategory||'',pageTitle:'',blocks:[],isNew:true}})">＋</button>`;
}

function setCategory(cat) {
  S.activeCategory = cat;
  renderList();
}

/* ── VIEW PAGE ── */
async function loadPage(category, pageTitle) {
  go("view", {});
  app.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:80vh"><div class="spinner dark"></div></div>`;
  try {
    const data = await api("getPage", { category, pageTitle });
    S.pageData = data;
    renderView();
  } catch (e) {
    toast(e.message, "error");
    go("list");
  }
}

function renderView() {
  if (!S.pageData) return go("list");
  const { category, pageTitle, blocks, updatedAt } = S.pageData;
  const blocksHtml = (blocks || []).map(renderBlock).join("");
  const date = updatedAt ? new Date(updatedAt).toLocaleString("th-TH") : "-";

  app.innerHTML = `
    <div class="app-wrapper">
      <nav class="sidebar">
        <div class="sidebar-header">
          <div class="sidebar-brand">
            <svg width="36" height="36" viewBox="0 0 48 48" fill="none">
              <rect width="48" height="48" rx="14" fill="#6366f1"/>
              <path d="M14 16h20M14 24h14M14 32h18" stroke="white" stroke-width="2.5" stroke-linecap="round"/>
            </svg>
            <div><div class="sidebar-brand-text">Private Note</div>
            <div class="sidebar-brand-sub">ระบบจดบันทึกส่วนตัว</div></div>
          </div>
        </div>
        <div class="sidebar-nav">
          <button class="sidebar-cat-btn" onclick="go('list')">
            <span class="sidebar-cat-icon">←</span>
            <span>กลับหน้าหลัก</span>
          </button>
        </div>
      </nav>
      <div class="main-area">
        <div class="mobile-header">
          <button class="main-header-back" onclick="go('list')">←</button>
          <div class="mobile-header-title">${esc(pageTitle)}</div>
          <button class="btn btn-ghost btn-sm" onclick="startEdit()">✏️</button>
        </div>
        <div class="main-header">
          <button class="main-header-back" onclick="go('list')">
            <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
          </button>
          <div class="main-header-title">${esc(pageTitle)}</div>
          <span class="main-header-badge">${esc(category)}</span>
          <div class="main-header-actions">
            <button class="btn btn-ghost btn-sm" onclick="startEdit()">✏️ แก้ไข</button>
            <button class="btn btn-danger btn-sm" onclick="deletePage()">🗑️ ลบ</button>
          </div>
        </div>
        <div class="content-area">
          <div class="blocks-container">${blocksHtml || '<div class="empty-state"><div class="empty-state-icon">📄</div><div class="empty-state-title">ไม่มีเนื้อหา</div></div>'}</div>
          <div class="text-muted mt-4" style="font-size:11.5px">อัปเดตล่าสุด: ${date}</div>
        </div>
      </div>
    </div>`;
}

function renderBlock(b) {
  if (b.type === "text") return `
    <div class="block-card">
      ${b.label ? `<div class="block-label">${esc(b.label)}</div>` : ""}
      <div class="block-value">${esc(b.value || "")}</div>
    </div>`;

  if (b.type === "table") {
    const rows = b.data || [];
    if (!rows.length) return `<div class="block-card"><div class="block-value text-muted">ตารางว่าง</div></div>`;
    const cols = Object.keys(rows[0]);
    const thead = cols.map(c => `<th>${esc(c)}</th>`).join("");
    const tbody = rows.map(r =>
      `<tr>${cols.map(c => `<td class="copy-cell" onclick="copyText('${esc(r[c] || "")}')">${esc(r[c] || "")}<span class="copy-btn">คัดลอก</span></td>`).join("")}</tr>`
    ).join("");
    return `<div class="block-card"><div class="block-table-wrap"><table class="block-table"><thead><tr>${thead}</tr></thead><tbody>${tbody}</tbody></table></div></div>`;
  }

  if (b.type === "image") return `
    <div class="block-card">
      ${b.url ? `<img src="${esc(b.url)}" class="block-image" onerror="this.parentElement.innerHTML='<div class=block-image-placeholder>โหลดรูปไม่ได้</div>'">` : '<div class="block-image-placeholder">ไม่มี URL</div>'}
    </div>`;

  return "";
}

function copyText(text) {
  navigator.clipboard.writeText(text).then(() => toast("คัดลอกแล้ว ✓", "success"));
}

async function deletePage() {
  const ok = await confirm("ลบหน้านี้?", `คุณต้องการลบ "${S.pageData.pageTitle}" ใช่ไหม? การดำเนินการนี้ไม่สามารถยกเลิกได้`);
  if (!ok) return;
  try {
    await api("deletePage", { category: S.pageData.category, pageTitle: S.pageData.pageTitle });
    toast("ลบสำเร็จ", "success");
    await loadCategories();
    go("list");
  } catch (e) {
    toast(e.message, "error");
  }
}

function startEdit() {
  go("edit", { editData: { ...S.pageData, isNew: false } });
}

/* ── EDIT VIEW ── */
function renderEdit() {
  const ls = document.getElementById("loading-screen");
  if (ls) ls.style.display = "none";
  const d = S.editData || { category: "", pageTitle: "", blocks: [], isNew: true };
  const cats = S.categories.map(c => `<option value="${esc(c.category)}">`).join("");
  const blocksHtml = (d.blocks || []).map((b, i) => renderEditBlock(b, i)).join("");

  app.innerHTML = `
    <div class="app-wrapper">
      <nav class="sidebar">
        <div class="sidebar-header">
          <div class="sidebar-brand">
            <svg width="36" height="36" viewBox="0 0 48 48" fill="none">
              <rect width="48" height="48" rx="14" fill="#6366f1"/>
              <path d="M14 16h20M14 24h14M14 32h18" stroke="white" stroke-width="2.5" stroke-linecap="round"/>
            </svg>
            <div><div class="sidebar-brand-text">Private Note</div></div>
          </div>
        </div>
        <div class="sidebar-nav">
          <button class="sidebar-cat-btn" onclick="go('list')">
            <span class="sidebar-cat-icon">←</span><span>กลับหน้าหลัก</span>
          </button>
        </div>
      </nav>
      <div class="main-area">
        <div class="mobile-header">
          <button class="main-header-back" onclick="go('list')">←</button>
          <div class="mobile-header-title">${d.isNew ? "เพิ่มหน้าใหม่" : "แก้ไขหน้า"}</div>
        </div>
        <div class="main-header">
          <button class="main-header-back" onclick="go('list')">
            <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
          </button>
          <div class="main-header-title">${d.isNew ? "เพิ่มหน้าใหม่" : "แก้ไขหน้า"}</div>
        </div>
        <div class="content-area">
          <div class="edit-form">
            <datalist id="cat-list">${cats}</datalist>
            <div class="flex gap-3">
              <div class="form-group" style="flex:1">
                <label class="form-label">หมวดหมู่</label>
                <input id="e-cat" class="form-input" list="cat-list" value="${esc(d.category)}" placeholder="เช่น Pass Birthday">
              </div>
              <div class="form-group" style="flex:2">
                <label class="form-label">ชื่อหน้า</label>
                <input id="e-title" class="form-input" value="${esc(d.pageTitle)}" placeholder="เช่น Email Account">
              </div>
            </div>
            <div>
              <div class="section-heading">Blocks</div>
              <div class="edit-blocks" id="edit-blocks">${blocksHtml}</div>
              <div class="add-block-row mt-4">
                <button class="add-block-btn" onclick="addBlock('text')">＋ Text</button>
                <button class="add-block-btn" onclick="addBlock('table')">＋ Table</button>
                <button class="add-block-btn" onclick="addBlock('image')">＋ Image</button>
              </div>
            </div>
            <div class="flex gap-2" style="justify-content:flex-end">
              <button class="btn btn-ghost" onclick="go('list')">ยกเลิก</button>
              <button class="btn btn-primary" onclick="savePage()">
                <svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7"/></svg>
                บันทึก
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>`;
}

function renderEditBlock(b, i) {
  if (b.type === "text") return `
    <div class="edit-block-card" id="blk-${i}">
      <div class="edit-block-header">
        <span class="edit-block-type-badge badge-text">Text</span>
        <input style="flex:1;border:none;outline:none;font-size:13px;background:none;color:var(--text-2);" placeholder="Label" value="${esc(b.label||"")}" onchange="updateBlock(${i},'label',this.value)">
        <button class="btn btn-icon text-danger" onclick="removeBlock(${i})">✕</button>
      </div>
      <div class="edit-block-body">
        <textarea class="form-textarea" placeholder="เนื้อหา..." onchange="updateBlock(${i},'value',this.value)">${esc(b.value||"")}</textarea>
      </div>
    </div>`;

  if (b.type === "table") {
    const rows = b.data || [{}];
    const cols = Object.keys(rows[0] || {});
    if (!cols.length) return `
      <div class="edit-block-card" id="blk-${i}">
        <div class="edit-block-header">
          <span class="edit-block-type-badge badge-table">Table</span>
          <button class="btn btn-icon text-danger ml-auto" onclick="removeBlock(${i})">✕</button>
        </div>
        <div class="edit-block-body">
          <div class="form-group">
            <label class="form-label">กำหนด Columns (คั่นด้วยจุลภาค)</label>
            <input class="form-input" placeholder="เช่น user,pass,url" onchange="initTableCols(${i},this.value)">
          </div>
        </div>
      </div>`;

    const gridCols = `repeat(${cols.length}, minmax(120px,1fr)) 36px`;
    const headCells = cols.map(c => `<div class="table-cell-header"><input value="${esc(c)}" onchange="renameCol(${i},'${esc(c)}',this.value)"></div>`).join("") + `<div class="table-cell-header"><button onclick="addCol(${i})">＋</button></div>`;
    const bodyRows = rows.map((r, ri) =>
      cols.map(c => `<div class="table-cell-input"><input value="${esc(r[c]||"")}" onchange="updateCell(${i},${ri},'${esc(c)}',this.value)"></div>`).join("") +
      `<div class="table-cell-action"><button onclick="removeRow(${i},${ri})" style="color:var(--rose)">✕</button></div>`
    ).join("");

    return `
      <div class="edit-block-card" id="blk-${i}">
        <div class="edit-block-header">
          <span class="edit-block-type-badge badge-table">Table</span>
          <button class="btn btn-ghost btn-sm ml-auto" onclick="addRow(${i})">＋ Row</button>
          <button class="btn btn-icon text-danger" onclick="removeBlock(${i})">✕</button>
        </div>
        <div class="edit-block-body">
          <div class="table-editor">
            <div class="table-editor-grid" style="display:grid;grid-template-columns:${gridCols};">
              ${headCells}${bodyRows}
            </div>
          </div>
        </div>
      </div>`;
  }

  if (b.type === "image") return `
    <div class="edit-block-card" id="blk-${i}">
      <div class="edit-block-header">
        <span class="edit-block-type-badge badge-image">Image</span>
        <button class="btn btn-icon text-danger ml-auto" onclick="removeBlock(${i})">✕</button>
      </div>
      <div class="edit-block-body">
        <div class="form-group">
          <label class="form-label">URL รูปภาพ</label>
          <input class="form-input" value="${esc(b.url||"")}" placeholder="https://..." onchange="updateBlock(${i},'url',this.value)">
        </div>
        <div class="upload-zone" onclick="document.getElementById('img-upload-${i}').click()">
          <svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path d="M4 16l4-4 4 4 4-6 4 6"/><rect x="3" y="3" width="18" height="18" rx="2"/></svg>
          <div class="upload-zone-text">คลิกเพื่ออัปโหลดรูปภาพ</div>
          <input type="file" id="img-upload-${i}" accept="image/*" style="display:none" onchange="uploadImage(${i},this)">
        </div>
        ${b.url ? `<img src="${esc(b.url)}" class="upload-preview">` : ""}
      </div>
    </div>`;

  return "";
}

/* ── Block Mutations ── */
function addBlock(type) {
  const defaults = { text: { type:"text", label:"", value:"" }, table: { type:"table", data:[] }, image: { type:"image", url:"" } };
  S.editData.blocks.push(defaults[type]);
  renderEdit();
}
function removeBlock(i) { S.editData.blocks.splice(i, 1); renderEdit(); }
function updateBlock(i, key, val) { S.editData.blocks[i][key] = val; }
function updateCell(bi, ri, col, val) { S.editData.blocks[bi].data[ri][col] = val; }
function addRow(bi) {
  const cols = Object.keys(S.editData.blocks[bi].data[0] || {});
  const row = {}; cols.forEach(c => row[c] = "");
  S.editData.blocks[bi].data.push(row);
  renderEdit();
}
function removeRow(bi, ri) { S.editData.blocks[bi].data.splice(ri, 1); renderEdit(); }
function addCol(bi) {
  const name = prompt("ชื่อ Column ใหม่:", "column");
  if (!name) return;
  S.editData.blocks[bi].data.forEach(r => r[name] = "");
  if (!S.editData.blocks[bi].data.length) S.editData.blocks[bi].data.push({ [name]: "" });
  renderEdit();
}
function renameCol(bi, old, nw) {
  S.editData.blocks[bi].data = S.editData.blocks[bi].data.map(r => {
    const nr = {};
    Object.keys(r).forEach(k => { nr[k === old ? nw : k] = r[k]; });
    return nr;
  });
}
function initTableCols(bi, val) {
  const cols = val.split(",").map(c => c.trim()).filter(Boolean);
  const row = {}; cols.forEach(c => row[c] = "");
  S.editData.blocks[bi].data = [row];
  renderEdit();
}

/* ── Image Upload ── */
async function uploadImage(bi, input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      toast("กำลังอัปโหลด...", "info");
      const res = await api("uploadImage", { base64Data: e.target.result, mimeType: file.type, fileName: file.name });
      S.editData.blocks[bi].url = res.url;
      toast("อัปโหลดสำเร็จ", "success");
      renderEdit();
    } catch (err) {
      toast(err.message, "error");
    }
  };
  reader.readAsDataURL(file);
}

/* ── Save ── */
async function savePage() {
  const cat   = document.getElementById("e-cat")?.value.trim();
  const title = document.getElementById("e-title")?.value.trim();
  if (!cat || !title) { toast("กรุณากรอกหมวดหมู่และชื่อหน้า", "error"); return; }

  S.editData.category  = cat;
  S.editData.pageTitle = title;

  const saveBtn = document.querySelector(".btn-primary");
  if (saveBtn) { saveBtn.disabled = true; saveBtn.innerHTML = '<div class="spinner"></div> กำลังบันทึก...'; }

  try {
    await api("savePage", { category: cat, pageTitle: title, blocks: S.editData.blocks });
    toast("บันทึกสำเร็จ ✓", "success");
    await loadCategories();
    const data = await api("getPage", { category: cat, pageTitle: title });
    S.pageData = data;
    go("view");
  } catch (e) {
    toast(e.message, "error");
    if (saveBtn) { saveBtn.disabled = false; saveBtn.innerHTML = "บันทึก"; }
  }
}

/* ── Init ── */
async function loadCategories() {
  const res = await api("listTitles");
  S.categories = res.categories || [];
}

async function init() {
  try {
    await liff.init({ liffId: C.LIFF_ID });
    if (!liff.isLoggedIn()) { liff.login(); return; }
    S.token = liff.getAccessToken();
  } catch (e) {
    console.warn("LIFF init failed:", e.message);
    S.token = "LIFF_UNAVAILABLE";
  }
  try {
    await loadCategories();
    go("list");
  } catch (e) {
    toast(e.message, "error");
    document.getElementById("loading-screen").innerHTML = `
      <div style="text-align:center;padding:32px;">
        <div style="font-size:48px">⚠️</div>
        <div style="font-size:15px;font-weight:600;margin-top:12px;">เชื่อมต่อ API ไม่ได้</div>
        <div style="font-size:13px;color:var(--text-3);margin-top:8px">${e.message}</div>
        <button class="btn btn-primary" style="margin-top:20px" onclick="location.reload()">ลองใหม่</button>
      </div>`;
  }
}

function esc(s) {
  return String(s ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

init();
