(function () {
  const user = requireRoleOrRedirect('dev');
  if (!user) return;

  document.getElementById('userName').textContent = `${user.ism} (${user.rol})`;
  document.getElementById('logoutBtn').addEventListener('click', () => {
    clearSession();
    window.location.href = '/index.html';
  });

  // ---------- Tab almashtirish ----------
  const tabBtns = document.querySelectorAll('.tab-btn');
  const panels = document.querySelectorAll('.tab-panel');
  tabBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      tabBtns.forEach((b) => b.classList.remove('active'));
      panels.forEach((p) => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
    });
  });

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str ?? '';
    return div.innerHTML;
  }

  // ==================================================
  // UMUMIY
  // ==================================================
  async function loadOverview() {
    const [usersData, productsData, categoriesData, salesData, summary] = await Promise.all([
      api('/users'),
      api('/products'),
      api('/categories'),
      api('/sales'),
      api('/reports/summary'),
    ]);

    const grid = document.getElementById('overviewGrid');
    const bloklar = [
      ['👥', 'Jami foydalanuvchilar', usersData.users.length, null],
      ['📦', 'Jami mahsulotlar', productsData.products.length, null],
      ['🗂️', 'Jami kategoriyalar', categoriesData.categories.length, null],
      ['🧾', 'Jami sotuvlar (yozuvlar)', salesData.soni, null],
      ['💰', 'Bugungi tushum', pul(summary.bugun.tushum), `${summary.bugun.sotuvlar_soni} ta sotuv`],
      ['🏆', 'Shu oylik tushum', pul(summary.oy.tushum), `${summary.oy.sotuvlar_soni} ta sotuv`],
    ];
    grid.innerHTML = bloklar
      .map(
        ([emoji, label, qiymat, sub]) => `
        <div class="stat-card">
          <div class="stat-icon">${emoji}</div>
          <div>
            <div class="label">${label}</div>
            <div class="value">${qiymat}</div>
            ${sub ? `<div class="sub">${sub}</div>` : ''}
          </div>
        </div>`
      )
      .join('');

    const devSoni = usersData.users.filter((u) => u.rol === 'dev').length;
    const adminSoni = usersData.users.filter((u) => u.rol === 'admin').length;
    const sotuvchiSoni = usersData.users.filter((u) => u.rol === 'sotuvchi').length;
    const lowStockCount = productsData.products.filter((p) => p.miqdor <= p.min_miqdor).length;

    document.getElementById('systemInfoBody').innerHTML = `
      <tr><td>Dev hisoblar soni</td><td>${devSoni}</td></tr>
      <tr><td>Admin hisoblar soni</td><td>${adminSoni}</td></tr>
      <tr><td>Sotuvchi hisoblar soni</td><td>${sotuvchiSoni}</td></tr>
      <tr><td>Kam qoldiqli mahsulotlar</td><td>${lowStockCount}</td></tr>
    `;
  }

  // ==================================================
  // FOYDALANUVCHILAR
  // ==================================================
  const userForm = document.getElementById('userForm');
  const userError = document.getElementById('userError');

  document.getElementById('toggleUserForm').addEventListener('click', () => {
    resetUserForm();
    userForm.classList.toggle('hidden');
  });

  document.getElementById('cancelUserEdit').addEventListener('click', () => {
    resetUserForm();
    userForm.classList.add('hidden');
  });

  function resetUserForm() {
    userForm.reset();
    document.getElementById('userId').value = '';
    document.getElementById('userSubmitBtn').textContent = 'Saqlash';
    document.getElementById('u_parol').required = true;
    document.getElementById('parolHint').textContent = '';
    userError.classList.remove('show');
  }

  function fillUserForm(u) {
    document.getElementById('userId').value = u.id;
    document.getElementById('u_ism').value = u.ism;
    document.getElementById('u_login').value = u.login;
    document.getElementById('u_parol').value = '';
    document.getElementById('u_parol').required = false;
    document.getElementById('parolHint').textContent = "(bo'sh qoldirsangiz o'zgarmaydi)";
    document.getElementById('u_rol').value = u.rol;
    document.getElementById('userSubmitBtn').textContent = 'Yangilash';
    userForm.classList.remove('hidden');
  }

  userForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    userError.classList.remove('show');
    const id = document.getElementById('userId').value;
    const payload = {
      ism: document.getElementById('u_ism').value.trim(),
      login: document.getElementById('u_login').value.trim(),
      rol: document.getElementById('u_rol').value,
    };
    const parol = document.getElementById('u_parol').value;
    if (parol) payload.parol = parol;

    try {
      if (id) {
        await api(`/users/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
        showToast('Foydalanuvchi yangilandi');
      } else {
        await api('/users', { method: 'POST', body: JSON.stringify(payload) });
        showToast("Foydalanuvchi qo'shildi");
      }
      resetUserForm();
      userForm.classList.add('hidden');
      await loadUsers();
      await loadOverview();
    } catch (err) {
      userError.textContent = err.message;
      userError.classList.add('show');
    }
  });

  async function loadUsers() {
    const data = await api('/users');
    const body = document.getElementById('usersBody');
    body.innerHTML = data.users
      .map(
        (u) => `
        <tr>
          <td>${u.id}</td>
          <td>${escapeHtml(u.ism)}</td>
          <td>${escapeHtml(u.login)}</td>
          <td><span class="badge ${u.rol}">${u.rol}</span></td>
          <td>${sanaFormat(u.created_at)}</td>
          <td class="actions-cell">
            <button class="btn-sm btn-secondary" data-edit="${u.id}">Tahrirlash</button>
            <button class="btn-sm btn-danger" data-del="${u.id}" ${u.id === user.id ? 'disabled' : ''}>O'chirish</button>
          </td>
        </tr>`
      )
      .join('');

    body.querySelectorAll('[data-edit]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const u = data.users.find((x) => x.id === Number(btn.dataset.edit));
        if (u) fillUserForm(u);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    });
    body.querySelectorAll('[data-del]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (!confirm("Foydalanuvchini o'chirishni tasdiqlaysizmi?")) return;
        try {
          await api(`/users/${btn.dataset.del}`, { method: 'DELETE' });
          showToast("Foydalanuvchi o'chirildi");
          await loadUsers();
          await loadOverview();
        } catch (err) {
          showToast(err.message, 'error');
        }
      });
    });
  }

  // ==================================================
  // MAHSULOTLAR (xom ma'lumot)
  // ==================================================
  async function loadProducts() {
    const data = await api('/products');
    const body = document.getElementById('productsBody');
    if (!data.products.length) {
      body.innerHTML = `<tr><td colspan="10" style="color:#6b7280">Mahsulot topilmadi</td></tr>`;
      return;
    }
    body.innerHTML = data.products
      .map(
        (p) => `
        <tr>
          <td>${p.id}</td>
          <td>${escapeHtml(p.nomi)}</td>
          <td>${escapeHtml(p.kategoriya || '-')}</td>
          <td>${escapeHtml(p.ichki_guruh || '-')}</td>
          <td>${pul(p.tannarx)}</td>
          <td>${pul(p.sotish_narxi)}</td>
          <td>${p.miqdor}</td>
          <td>${p.min_miqdor}</td>
          <td>${p.rasm ? `<img class="thumb" src="${p.rasm}" alt="" />` : "yo'q"}</td>
          <td>${sanaFormat(p.created_at)}</td>
        </tr>`
      )
      .join('');
  }

  document.getElementById('exportProductsCsv').addEventListener('click', async () => {
    try {
      await downloadCsv('/products/export/csv', 'mahsulotlar.csv');
      showToast('CSV yuklandi');
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  // ==================================================
  // KATEGORIYALAR (xom ma'lumot)
  // ==================================================
  async function loadCategories() {
    const data = await api('/categories');
    const body = document.getElementById('categoriesBody');
    if (!data.categories.length) {
      body.innerHTML = `<tr><td colspan="6" style="color:#6b7280">Kategoriya topilmadi</td></tr>`;
      return;
    }
    body.innerHTML = data.categories
      .map(
        (c) => `
        <tr>
          <td>${c.id}</td>
          <td>${escapeHtml(c.nomi)}</td>
          <td>${escapeHtml(c.icon || '-')}</td>
          <td>${c.rasm ? `<img class="thumb" src="${c.rasm}" alt="" />` : "yo'q"}</td>
          <td>${c.soni}</td>
          <td>${sanaFormat(c.created_at)}</td>
        </tr>`
      )
      .join('');
  }

  // ==================================================
  // SOTUVLAR (xom ma'lumot)
  // ==================================================
  async function loadSales() {
    const data = await api('/sales');
    const body = document.getElementById('salesBody');
    if (!data.sales.length) {
      body.innerHTML = `<tr><td colspan="8" style="color:#6b7280">Sotuv topilmadi</td></tr>`;
      return;
    }
    body.innerHTML = data.sales
      .map(
        (s) => `
        <tr>
          <td>${s.id}</td>
          <td>${sanaFormat(s.sana)}</td>
          <td>${escapeHtml(s.mahsulot_nomi)}</td>
          <td>${escapeHtml(s.sotuvchi_ismi)}</td>
          <td>${s.miqdor}</td>
          <td>${pul(s.narx_dona)}</td>
          <td>${pul(s.jami_summa)}</td>
          <td style="font-size:11px; color:#9aa1b1">${s.buyurtma_id ? s.buyurtma_id.slice(0, 8) + '…' : '-'}</td>
        </tr>`
      )
      .join('');
  }

  document.getElementById('exportSalesCsv').addEventListener('click', async () => {
    try {
      await downloadCsv('/sales/export/csv', 'sotuvlar.csv');
      showToast('CSV yuklandi');
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  // ---------- Boshlash ----------
  loadOverview();
  loadUsers();
  loadProducts();
  loadCategories();
  loadSales();
})();
