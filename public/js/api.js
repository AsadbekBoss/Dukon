const API_BASE = '/api';

function getToken() {
  return localStorage.getItem('dukon_token');
}

function getUser() {
  const raw = localStorage.getItem('dukon_user');
  return raw ? JSON.parse(raw) : null;
}

function setSession(token, user) {
  localStorage.setItem('dukon_token', token);
  localStorage.setItem('dukon_user', JSON.stringify(user));
}

function clearSession() {
  localStorage.removeItem('dukon_token');
  localStorage.removeItem('dukon_user');
}

async function api(path, options = {}) {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  // Login so'rovining o'zi 401 qaytarsa (login/parol xato), bu sessiya muddati
  // tugashi emas — shunchaki xato xabarini oddiy tarzda ko'rsatish kerak.
  if (res.status === 401 && path !== '/auth/login') {
    clearSession();
    window.location.href = '/index.html';
    throw new Error('Tizimga qayta kirish kerak');
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.xato || 'Xatolik yuz berdi');
  }
  return data;
}

function homePageFor(rol) {
  if (rol === 'dev') return '/dev.html';
  if (rol === 'admin') return '/admin.html';
  return '/seller.html';
}

function requireRoleOrRedirect(role) {
  const user = getUser();
  const token = getToken();
  if (!token || !user) {
    window.location.href = '/index.html';
    return null;
  }
  // "dev" — barcha panellarga kira oladi, faqat o'z sahifasidan boshqasiga majburlab yo'naltirilmaydi
  if (user.rol !== role && user.rol !== 'dev') {
    window.location.href = homePageFor(user.rol);
    return null;
  }
  return user;
}

async function downloadCsv(path, filename) {
  const token = getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.xato || "Faylni yuklab bo'lmadi");
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function fileToResizedDataUrl(file, maxDim = 500, quality = 0.8) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => reject(new Error("Rasmni o'qib bo'lmadi"));
      img.src = reader.result;
    };
    reader.onerror = () => reject(new Error("Faylni o'qib bo'lmadi"));
    reader.readAsDataURL(file);
  });
}

let toastContainer = null;
function showToast(message, type = 'success') {
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.className = 'toast-container';
    document.body.appendChild(toastContainer);
  }
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  toastContainer.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('show'));
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 250);
  }, 3200);
}

function pul(son) {
  return Number(son || 0).toLocaleString('uz-UZ') + " so'm";
}

function sanaFormat(iso) {
  const d = new Date(iso);
  return d.toLocaleString('uz-UZ', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Shtrix-kod skaneri: kamerani ochib, kod topilganda onDetected(kod) ni chaqiradi.
// html5-qrcode kutubxonasi CDN orqali yuklanadi (public/*.html fayllarida <script> tegi bilan).
function openBarcodeScanner(onDetected) {
  if (typeof Html5Qrcode === 'undefined') {
    showToast("Skaner kutubxonasi yuklanmadi — internet aloqasini tekshiring", 'error');
    return;
  }

  const overlay = document.createElement('div');
  overlay.className = 'scanner-overlay';
  overlay.innerHTML = `
    <div class="scanner-box">
      <div class="scanner-header">
        <h3 style="margin:0">📷 Shtrix-kodni skanerlang</h3>
        <button type="button" class="btn-sm btn-secondary" id="scannerCloseBtn">✕ Yopish</button>
      </div>
      <div id="scanner-region"></div>
      <p class="scanner-hint">Mahsulot shtrix-kodini kamera oldiga tuting</p>
    </div>
  `;
  document.body.appendChild(overlay);

  const html5QrCode = new Html5Qrcode('scanner-region');
  let stopped = false;

  function cleanup() {
    if (stopped) return;
    stopped = true;
    html5QrCode
      .stop()
      .catch(() => {})
      .finally(() => overlay.remove());
  }

  overlay.querySelector('#scannerCloseBtn').addEventListener('click', cleanup);

  html5QrCode
    .start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: { width: 260, height: 160 } },
      (decodedText) => {
        cleanup();
        onDetected(decodedText);
      },
      () => {} // har bir freymda topilmasa xato beradi — e'tiborsiz qoldiramiz
    )
    .catch(() => {
      showToast("Kameraga ruxsat berilmadi yoki topilmadi", 'error');
      overlay.remove();
    });
}
