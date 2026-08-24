(function () {
  const user = requireRoleOrRedirect('admin');
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

  // ==================================================
  // DASHBOARD
  // ==================================================
  let revenueChart = null;

  async function loadSummary() {
    const data = await api('/reports/summary');
    const grid = document.getElementById('summaryGrid');
    const bloklar = [
      ['💰', 'Bugungi tushum', data.bugun.tushum, data.bugun.sotuvlar_soni],
      ['📈', 'Bugungi foyda', data.bugun.foyda, null],
      ['📅', 'Shu haftalik tushum', data.hafta.tushum, data.hafta.sotuvlar_soni],
      ['🗓️', 'Shu oylik tushum', data.oy.tushum, data.oy.sotuvlar_soni],
      ['🏆', 'Shu oylik foyda', data.oy.foyda, null],
    ];
    grid.innerHTML = bloklar
      .map(
        ([emoji, label, qiymat, soni]) => `
        <div class="stat-card">
          <div class="stat-icon">${emoji}</div>
          <div>
            <div class="label">${label}</div>
            <div class="value">${pul(qiymat)}</div>
            ${soni != null ? `<div class="sub">${soni} ta sotuv</div>` : ''}
          </div>
        </div>`
      )
      .join('');
  }

  async function loadFinance() {
    const [summary, inventory] = await Promise.all([api('/reports/summary'), api('/reports/inventory-value')]);
    const grid = document.getElementById('financeGrid');
    const bloklar = [
      ['🛒', 'Jami xarid summasi', inventory.jami_xarid, `${inventory.jami_dona} dona omborda`],
      ['💵', 'Jami sof foyda (hammasi)', summary.hammasi.foyda, `${summary.hammasi.sotuvlar_soni} ta sotuv`],
      ['📊', 'Jami tushum (hammasi)', summary.hammasi.tushum, null],
      ['🔮', "Potentsial foyda (qoldiq to'liq sotilsa)", inventory.potentsial_foyda, null],
    ];
    grid.innerHTML = bloklar
      .map(
        ([emoji, label, qiymat, sub]) => `
        <div class="stat-card">
          <div class="stat-icon">${emoji}</div>
          <div>
            <div class="label">${label}</div>
            <div class="value">${pul(qiymat)}</div>
            ${sub ? `<div class="sub">${sub}</div>` : ''}
          </div>
        </div>`
      )
      .join('');
  }

  async function loadTimeseries() {
    const data = await api('/reports/timeseries?days=30');
    const ctx = document.getElementById('revenueChart').getContext('2d');
    const labels = data.kunlik.map((r) => r.kun.slice(5));
    const tushumlar = data.kunlik.map((r) => r.tushum);

    if (revenueChart) revenueChart.destroy();
    revenueChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: "Kunlik tushum (so'm)",
            data: tushumlar,
            borderColor: '#2563eb',
            backgroundColor: 'rgba(37, 99, 235, 0.12)',
            fill: true,
            tension: 0.25,
            pointRadius: 2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, ticks: { callback: (v) => v.toLocaleString('uz-UZ') } },
        },
      },
    });
  }

  function setupPeriodButtons(containerSelector, onChange) {
    const container = document.querySelector(containerSelector);
    const btns = container.querySelectorAll('button');
    btns.forEach((btn) => {
      btn.addEventListener('click', () => {
        btns.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        onChange(btn.dataset.period);
      });
    });
  }

  async function loadSellerReport(period) {
    const q = period && period !== 'all' ? `?period=${period}` : '';
    const data = await api(`/reports/by-seller${q}`);
    const body = document.getElementById('sellerReportBody');
    if (!data.sotuvchilar.length) {
      body.innerHTML = `<tr><td colspan="5" style="color:#6b7280">Ma'lumot topilmadi</td></tr>`;
      return;
    }
    body.innerHTML = data.sotuvchilar
      .map(
        (s) => `
        <tr>
          <td>${escapeHtml(s.sotuvchi_ismi)}</td>
          <td>${s.sotuvlar_soni}</td>
          <td>${s.soni}</td>
          <td>${pul(s.tushum)}</td>
          <td>${pul(s.foyda)}</td>
        </tr>`
      )
      .join('');
  }

  async function loadTopProducts(period) {
    const q = period && period !== 'all' ? `?period=${period}` : '';
    const data = await api(`/reports/top-products${q}`);
    const body = document.getElementById('topProductsBody');
    if (!data.mahsulotlar.length) {
      body.innerHTML = `<tr><td colspan="5" style="color:#6b7280">Ma'lumot topilmadi</td></tr>`;
      return;
    }
    body.innerHTML = data.mahsulotlar
      .map(
        (m, i) => `
        <tr>
          <td>${i + 1}</td>
          <td>${escapeHtml(m.mahsulot_nomi)}</td>
          <td>${m.soni}</td>
          <td>${pul(m.tushum)}</td>
          <td>${pul(m.foyda)}</td>
        </tr>`
      )
      .join('');
  }

  async function loadTopProfit(period) {
    const params = new URLSearchParams({ sort: 'foyda' });
    if (period && period !== 'all') params.set('period', period);
    const data = await api(`/reports/top-products?${params.toString()}`);
    const body = document.getElementById('topProfitBody');
    if (!data.mahsulotlar.length) {
      body.innerHTML = `<tr><td colspan="5" style="color:#6b7280">Ma'lumot topilmadi</td></tr>`;
      return;
    }
    body.innerHTML = data.mahsulotlar
      .map(
        (m, i) => `
        <tr>
          <td>${i + 1}</td>
          <td>${escapeHtml(m.mahsulot_nomi)}</td>
          <td>${m.soni}</td>
          <td>${pul(m.tushum)}</td>
          <td>${pul(m.foyda)}</td>
        </tr>`
      )
      .join('');
  }

  setupPeriodButtons('[data-target="seller-period"]', loadSellerReport);
  setupPeriodButtons('[data-target="top-period"]', loadTopProducts);
  setupPeriodButtons('[data-target="top-profit-period"]', loadTopProfit);

  async function loadLowStock() {
    const data = await api('/reports/low-stock');
    const banner = document.getElementById('lowStockBanner');
    const body = document.getElementById('lowStockBody');

    if (!data.mahsulotlar.length) {
      banner.classList.add('hidden');
      body.innerHTML = `<tr><td colspan="4" style="color:#6b7280">Hozircha kam qoldiqli mahsulot yo'q</td></tr>`;
      return;
    }

    banner.classList.remove('hidden');
    banner.innerHTML = `⚠️ <strong>${data.mahsulotlar.length} ta mahsulot</strong>ning qoldig'i kam — "Kam qoldiqli mahsulotlar" jadvaliga qarang.`;

    body.innerHTML = data.mahsulotlar
      .map(
        (p) => `
        <tr>
          <td>${escapeHtml(p.nomi)}</td>
          <td>${escapeHtml(p.kategoriya || '-')}</td>
          <td><span class="badge low-stock">${p.miqdor}</span></td>
          <td>${p.min_miqdor}</td>
        </tr>`
      )
      .join('');
  }

  document.getElementById('exportProductsCsv').addEventListener('click', async () => {
    try {
      await downloadCsv('/products/export/csv', 'mahsulotlar.csv');
      showToast('Mahsulotlar CSV yuklandi');
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  document.getElementById('exportSalesCsv').addEventListener('click', async () => {
    try {
      await downloadCsv('/sales/export/csv', 'sotuvlar.csv');
      showToast('Sotuvlar CSV yuklandi');
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  document.getElementById('downloadBackup').addEventListener('click', async () => {
    try {
      const sana = new Date().toISOString().slice(0, 10);
      await downloadCsv('/backup/download', `dukon-zaxira-${sana}.db`);
      showToast('Baza zaxirasi yuklandi');
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  function refreshDashboard() {
    loadSummary().catch(console.error);
    loadFinance().catch(console.error);
    loadTimeseries().catch(console.error);
    loadSellerReport('all').catch(console.error);
    loadTopProducts('all').catch(console.error);
    loadTopProfit('all').catch(console.error);
    loadLowStock().catch(console.error);
  }

  // ==================================================
  // MAHSULOTLAR
  // ==================================================
  const productForm = document.getElementById('productForm');
  const productError = document.getElementById('productError');
  const rasmFileInput = document.getElementById('p_rasm_file');
  const rasmCameraInput = document.getElementById('p_rasm_camera');
  const rasmPreview = document.getElementById('p_rasm_preview');
  let currentImageData = null;

  function renderImagePreview() {
    rasmPreview.innerHTML = currentImageData
      ? `<img src="${currentImageData}" alt="Mahsulot rasmi" />`
      : '📦';
  }

  async function handlePickedImage(inputEl) {
    const file = inputEl.files && inputEl.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showToast('Faqat rasm fayli tanlang', 'error');
      inputEl.value = '';
      return;
    }
    try {
      currentImageData = await fileToResizedDataUrl(file);
      renderImagePreview();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      inputEl.value = '';
    }
  }

  document.getElementById('p_rasm_pick_file').addEventListener('click', () => rasmFileInput.click());
  document.getElementById('p_rasm_pick_camera').addEventListener('click', () => rasmCameraInput.click());
  rasmFileInput.addEventListener('change', () => handlePickedImage(rasmFileInput));
  rasmCameraInput.addEventListener('change', () => handlePickedImage(rasmCameraInput));

  document.getElementById('p_rasm_clear').addEventListener('click', () => {
    currentImageData = null;
    rasmFileInput.value = '';
    rasmCameraInput.value = '';
    renderImagePreview();
  });

  function updateProfitPreview() {
    const preview = document.getElementById('profitPreview');
    const tannarx = Number(document.getElementById('p_tannarx').value);
    const sotish = Number(document.getElementById('p_sotish').value);
    if (!tannarx || !sotish) {
      preview.textContent = 'Tannarx va narxni kiriting — foyda avtomatik hisoblanadi';
      return;
    }
    const foyda = sotish - tannarx;
    const foizFoyda = tannarx > 0 ? Math.round((foyda / tannarx) * 100) : 0;
    preview.textContent =
      foyda >= 0
        ? `💰 Har dona sotilganda foyda: ${pul(foyda)} (${foizFoyda}%)`
        : `⚠️ Sotish narxi tannarxdan past — zarar: ${pul(Math.abs(foyda))}`;
  }

  function recomputeSotishNarxi() {
    const tannarx = Number(document.getElementById('p_tannarx').value);
    const foizVal = document.getElementById('p_foiz').value;
    const foiz = Number(foizVal);
    if (!Number.isNaN(tannarx) && tannarx > 0 && foizVal !== '' && !Number.isNaN(foiz)) {
      const sotish = Math.round(tannarx * (1 + foiz / 100));
      document.getElementById('p_sotish').value = sotish;
    }
    updateProfitPreview();
  }
  document.getElementById('p_foiz').addEventListener('input', recomputeSotishNarxi);
  document.getElementById('p_tannarx').addEventListener('input', recomputeSotishNarxi);
  document.getElementById('p_sotish').addEventListener('input', updateProfitPreview);

  const PERCENT_OPTIONS = [10, 20, 30, 50];
  function renderPercentChips() {
    const box = document.getElementById('percentChips');
    box.innerHTML = PERCENT_OPTIONS.map((p) => `<button type="button" class="chip" data-percent="${p}">+${p}%</button>`).join('');
    box.querySelectorAll('.chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        document.getElementById('p_foiz').value = chip.dataset.percent;
        box.querySelectorAll('.chip').forEach((c) => c.classList.remove('active'));
        chip.classList.add('active');
        recomputeSotishNarxi();
      });
    });
  }
  renderPercentChips();

  document.getElementById('p_kategoriya').addEventListener('input', (e) => updateSubgroupDatalist(e.target.value.trim()));

  document.getElementById('cancelProductEdit').addEventListener('click', () => {
    resetProductForm();
    productForm.classList.add('hidden');
  });

  function resetProductForm() {
    productForm.reset();
    document.getElementById('productId').value = '';
    document.getElementById('productSubmitBtn').textContent = 'Saqlash';
    productError.classList.remove('show');
    currentImageData = null;
    renderImagePreview();
    document.querySelectorAll('#percentChips .chip').forEach((c) => c.classList.remove('active'));
    updateProfitPreview();
    updateSubgroupDatalist('');
  }

  function fillProductForm(p) {
    document.getElementById('productId').value = p.id;
    document.getElementById('p_nomi').value = p.nomi;
    document.getElementById('p_kategoriya').value = p.kategoriya || '';
    document.getElementById('p_ichki_guruh').value = p.ichki_guruh || '';
    document.getElementById('p_tannarx').value = p.tannarx;
    document.getElementById('p_foiz').value = '';
    document.getElementById('p_sotish').value = p.sotish_narxi;
    document.getElementById('p_miqdor').value = p.miqdor;
    document.getElementById('p_min_miqdor').value = p.min_miqdor;
    document.getElementById('productSubmitBtn').textContent = 'Yangilash';
    document.querySelectorAll('#percentChips .chip').forEach((c) => c.classList.remove('active'));
    updateProfitPreview();
    updateSubgroupDatalist(p.kategoriya || '');
    currentImageData = p.rasm || null;
    renderImagePreview();
    productForm.classList.remove('hidden');
  }

  productForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    productError.classList.remove('show');
    const id = document.getElementById('productId').value;
    const payload = {
      nomi: document.getElementById('p_nomi').value.trim(),
      kategoriya: document.getElementById('p_kategoriya').value.trim(),
      ichki_guruh: document.getElementById('p_ichki_guruh').value.trim(),
      tannarx: Number(document.getElementById('p_tannarx').value),
      sotish_narxi: Number(document.getElementById('p_sotish').value),
      miqdor: Number(document.getElementById('p_miqdor').value),
      min_miqdor: Number(document.getElementById('p_min_miqdor').value || 5),
      rasm: currentImageData,
    };
    try {
      if (id) {
        await api(`/products/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
        showToast('Mahsulot yangilandi');
      } else {
        await api('/products', { method: 'POST', body: JSON.stringify(payload) });
        showToast("Mahsulot qo'shildi");
      }
      resetProductForm();
      productForm.classList.add('hidden');
      await refreshProductsSection();
      await loadLowStock();
    } catch (err) {
      productError.textContent = err.message;
      productError.classList.add('show');
    }
  });

  // ---------- Kategoriya panjarasi + mahsulot ro'yxati navigatsiyasi ----------
  const CATEGORY_ICONS = {
    'Maktab buyumlari': '✏️',
    "Bog'cha buyumlari": '🧸',
    'Badiy kitoblar': '📚',
    'Repetitor uchun materiallar': '📖',
    Sumkalar: '🎒',
  };
  const NO_CATEGORY_LABEL = 'Kategoriyasiz';
  const OTHER_SUBGROUP_LABEL = 'Boshqalar';
  const CATEGORY_ICON_CHOICES = ['🗂️', '✏️', '🧸', '📚', '📖', '🎒', '📦', '🖊️', '🎨', '📐', '🧮', '🎯'];

  // Rasm yuklanmagan kategoriyalar uchun emoji o'rniga chiziladigan vektor illyustratsiyalar
  const CATEGORY_VISUALS = {
    'Maktab buyumlari': {
      gradient: 'linear-gradient(135deg, #f59e0b, #d97706)',
      svg: `<svg viewBox="0 0 120 120" width="58" height="58"><g transform="rotate(45 60 60)"><rect x="50" y="18" width="20" height="62" rx="3" fill="#ffffff"/><rect x="50" y="18" width="20" height="14" rx="3" fill="#fde68a"/><path d="M50 80 L60 100 L70 80 Z" fill="#ffffff"/><circle cx="60" cy="96" r="2.5" fill="#92400e"/></g></svg>`,
    },
    "Bog'cha buyumlari": {
      gradient: 'linear-gradient(135deg, #f472b6, #db2777)',
      svg: `<svg viewBox="0 0 120 120" width="58" height="58"><rect x="18" y="55" width="34" height="34" rx="8" fill="#fecaca" transform="rotate(-8 35 72)"/><rect x="44" y="48" width="34" height="34" rx="8" fill="#bbf7d0" transform="rotate(6 61 65)"/><rect x="68" y="55" width="34" height="34" rx="8" fill="#fef08a" transform="rotate(-4 85 72)"/></svg>`,
    },
    'Badiy kitoblar': {
      gradient: 'linear-gradient(135deg, #a78bfa, #7c3aed)',
      svg: `<svg viewBox="0 0 120 120" width="58" height="58"><rect x="22" y="38" width="15" height="52" rx="2" fill="#ffffff"/><rect x="41" y="26" width="15" height="64" rx="2" fill="#fde68a"/><rect x="60" y="42" width="15" height="48" rx="2" fill="#fecaca"/><rect x="79" y="32" width="15" height="58" rx="2" fill="#bfdbfe"/></svg>`,
    },
    'Repetitor uchun materiallar': {
      gradient: 'linear-gradient(135deg, #38bdf8, #0369a1)',
      svg: `<svg viewBox="0 0 120 120" width="58" height="58"><path d="M60 38 C50 31 32 29 20 33 L20 84 C32 80 50 82 60 89 C70 82 88 80 100 84 L100 33 C88 29 70 31 60 38 Z" fill="#ffffff"/><line x1="60" y1="38" x2="60" y2="89" stroke="#0c4a6e" stroke-width="2"/></svg>`,
    },
    Sumkalar: {
      gradient: 'linear-gradient(135deg, #34d399, #059669)',
      svg: `<svg viewBox="0 0 120 120" width="58" height="58"><path d="M40 42 C40 25 80 25 80 42" stroke="#ffffff" stroke-width="6" fill="none" stroke-linecap="round"/><rect x="26" y="42" width="68" height="54" rx="10" fill="#ffffff"/><rect x="48" y="58" width="24" height="16" rx="4" fill="#a7f3d0"/></svg>`,
    },
  };
  const DEFAULT_VISUAL = {
    gradient: 'linear-gradient(135deg, #94a3b8, #475569)',
    svg: `<svg viewBox="0 0 120 120" width="58" height="58"><path d="M20 42 L46 42 L54 32 L100 32 L100 90 L20 90 Z" fill="#ffffff"/></svg>`,
  };
  const NO_CATEGORY_VISUAL = {
    gradient: 'linear-gradient(135deg, #cbd5e1, #94a3b8)',
    svg: `<svg viewBox="0 0 120 120" width="52" height="52"><circle cx="60" cy="60" r="34" fill="none" stroke="#ffffff" stroke-width="6"/><text x="60" y="72" font-size="34" fill="#ffffff" text-anchor="middle" font-family="Arial, sans-serif">?</text></svg>`,
  };

  let allProductsCache = [];
  let categoriesCache = [];
  let currentFilter = { type: 'grid' };
  let selectedNewIcon = CATEGORY_ICON_CHOICES[0];

  function categoryIconByName(name) {
    if (name === NO_CATEGORY_LABEL) return '❔';
    const found = categoriesCache.find((c) => c.nomi === name);
    return (found && found.icon) || CATEGORY_ICONS[name] || '🗂️';
  }

  function categoryVisual(name) {
    if (name === NO_CATEGORY_LABEL) return NO_CATEGORY_VISUAL;
    return CATEGORY_VISUALS[name] || DEFAULT_VISUAL;
  }

  function categoryPhotoMarkup(c) {
    if (c.rasm) return { style: '', inner: `<img src="${c.rasm}" alt="${escapeHtml(c.nomi)}" />` };
    const visual = categoryVisual(c.nomi);
    return { style: `background:${visual.gradient}`, inner: visual.svg };
  }

  function renderCategoryGrid() {
    const grid = document.getElementById('categoryGrid');
    const orphanCount = allProductsCache.filter((p) => !p.kategoriya).length;

    const cards = categoriesCache
      .slice()
      .sort((a, b) => a.nomi.localeCompare(b.nomi, 'uz'))
      .map((c) => {
        const photo = categoryPhotoMarkup(c);
        return `
        <div class="category-card" data-category="${escapeHtml(c.nomi)}">
          <button type="button" class="category-card-delete" data-delete-category="${c.id}" title="Kategoriyani o'chirish">×</button>
          <button type="button" class="category-card-edit" data-edit-category="${c.id}" title="Kategoriyani tahrirlash">✏️</button>
          <div class="category-card-photo" style="${photo.style}">${photo.inner}</div>
          <div class="category-card-body">
            <div class="name">${escapeHtml(c.nomi)}</div>
            <div class="count">${c.soni} ta mahsulot</div>
            ${c.kam_qoldiq ? `<div class="warn">⚠️ ${c.kam_qoldiq} ta kam qoldiq</div>` : ''}
          </div>
        </div>`;
      });

    if (orphanCount > 0) {
      cards.push(`
        <div class="category-card" data-category="${escapeHtml(NO_CATEGORY_LABEL)}">
          <div class="category-card-photo" style="background:${NO_CATEGORY_VISUAL.gradient}">${NO_CATEGORY_VISUAL.svg}</div>
          <div class="category-card-body">
            <div class="name">${NO_CATEGORY_LABEL}</div>
            <div class="count">${orphanCount} ta mahsulot</div>
          </div>
        </div>`);
    }

    cards.push(`
      <div class="category-card add-new" id="addCategoryTile">
        <div class="category-card-photo"><svg viewBox="0 0 120 120" width="52" height="52"><circle cx="60" cy="60" r="34" fill="none" stroke="currentColor" stroke-width="5" stroke-dasharray="6 8"/><line x1="60" y1="42" x2="60" y2="78" stroke="currentColor" stroke-width="6" stroke-linecap="round"/><line x1="42" y1="60" x2="78" y2="60" stroke="currentColor" stroke-width="6" stroke-linecap="round"/></svg></div>
        <div class="category-card-body"><div class="name">Yangi kategoriya</div></div>
      </div>`);

    grid.innerHTML = cards.join('');

    grid.querySelectorAll('.category-card[data-category]').forEach((card) => {
      card.addEventListener('click', () => openCategory(card.dataset.category));
    });
    grid.querySelectorAll('[data-delete-category]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteCategoryById(btn.dataset.deleteCategory);
      });
    });
    grid.querySelectorAll('[data-edit-category]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const cat = categoriesCache.find((c) => String(c.id) === btn.dataset.editCategory);
        if (cat) showEditCategoryBox(cat);
      });
    });
    const addTile = document.getElementById('addCategoryTile');
    if (addTile) addTile.addEventListener('click', () => showNewCategoryBox());
  }

  async function deleteCategoryById(id) {
    const cat = categoriesCache.find((c) => String(c.id) === String(id));
    if (!cat) return;
    if (!confirm(`"${cat.nomi}" kategoriyasini o'chirishni tasdiqlaysizmi?`)) return;
    try {
      await api(`/categories/${id}`, { method: 'DELETE' });
      showToast('Kategoriya o\'chirildi');
      if (currentFilter.type === 'category' && currentFilter.name === cat.nomi) {
        currentFilter = { type: 'grid' };
      }
      await refreshProductsSection();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  function setListVisible(visible) {
    document.getElementById('categoryGridView').classList.toggle('hidden', visible);
    document.getElementById('productListView').classList.toggle('hidden', !visible);
  }

  function itemsInCategory(name) {
    return name === NO_CATEGORY_LABEL
      ? allProductsCache.filter((p) => !p.kategoriya)
      : allProductsCache.filter((p) => p.kategoriya === name);
  }

  function showGridView() {
    currentFilter = { type: 'grid' };
    document.getElementById('productSearch').value = '';
    hideNewCategoryBox();
    resetProductForm();
    productForm.classList.add('hidden');
    setListVisible(false);
    renderCategoryGrid();
  }

  function openCategory(name) {
    currentFilter = { type: 'category', name };
    document.getElementById('productSearch').value = '';
    resetProductForm();
    productForm.classList.add('hidden');
    setListVisible(true);
    document.getElementById('categoryContext').textContent = '';
    document.getElementById('currentCategoryTitle').textContent = `${categoryIconByName(name)} ${name}`;
    document.getElementById('deleteCategoryBtn').classList.toggle('hidden', name === NO_CATEGORY_LABEL);
    renderCategoryLevel();
  }

  document.getElementById('deleteCategoryBtn').addEventListener('click', () => {
    if (currentFilter.type !== 'category' || currentFilter.name === NO_CATEGORY_LABEL) return;
    const cat = categoriesCache.find((c) => c.nomi === currentFilter.name);
    if (cat) deleteCategoryById(cat.id);
  });

  function renderCategoryLevel() {
    const name = currentFilter.name;
    const items = itemsInCategory(name);
    const hasSubgroups = name !== NO_CATEGORY_LABEL && items.some((p) => p.ichki_guruh);

    if (hasSubgroups) {
      document.getElementById('subgroupGridView').classList.remove('hidden');
      document.getElementById('productTableWrap').classList.add('hidden');
      renderSubgroupGrid(items);
    } else {
      document.getElementById('subgroupGridView').classList.add('hidden');
      document.getElementById('productTableWrap').classList.remove('hidden');
      renderProductList();
    }
  }

  function renderSubgroupGrid(items) {
    const grid = document.getElementById('subgroupGrid');
    const groups = new Map();
    for (const p of items) {
      const key = p.ichki_guruh || OTHER_SUBGROUP_LABEL;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(p);
    }
    const entries = [...groups.entries()].sort((a, b) => {
      if (a[0] === OTHER_SUBGROUP_LABEL) return 1;
      if (b[0] === OTHER_SUBGROUP_LABEL) return -1;
      return a[0].localeCompare(b[0], 'uz');
    });

    const FOLDER_SVG = `<svg viewBox="0 0 120 120" width="52" height="52"><path d="M20 42 L46 42 L54 32 L100 32 L100 90 L20 90 Z" fill="#ffffff"/></svg>`;

    grid.innerHTML = entries
      .map(([g, arr]) => {
        const lowCount = arr.filter((p) => p.miqdor <= p.min_miqdor).length;
        const withPhoto = arr.find((p) => p.rasm);
        const photo = withPhoto
          ? `<img src="${withPhoto.rasm}" alt="${escapeHtml(g)}" />`
          : FOLDER_SVG;
        const style = withPhoto
          ? ''
          : `background:${g === OTHER_SUBGROUP_LABEL ? 'linear-gradient(135deg, #cbd5e1, #94a3b8)' : 'linear-gradient(135deg, #818cf8, #4f46e5)'}`;
        return `
        <div class="category-card" data-subgroup="${escapeHtml(g)}">
          <div class="category-card-photo" style="${style}">${photo}</div>
          <div class="category-card-body">
            <div class="name">${escapeHtml(g)}</div>
            <div class="count">${arr.length} ta mahsulot</div>
            ${lowCount ? `<div class="warn">⚠️ ${lowCount} ta kam qoldiq</div>` : ''}
          </div>
        </div>`;
      })
      .join('');

    grid.querySelectorAll('.category-card[data-subgroup]').forEach((card) => {
      card.addEventListener('click', () => openSubgroup(currentFilter.name, card.dataset.subgroup));
    });
  }

  function openSubgroup(category, subgroup) {
    currentFilter = { type: 'subgroup', category, name: subgroup };
    document.getElementById('productSearch').value = '';
    resetProductForm();
    productForm.classList.add('hidden');
    document.getElementById('subgroupGridView').classList.add('hidden');
    document.getElementById('productTableWrap').classList.remove('hidden');
    document.getElementById('categoryContext').textContent = `${categoryIconByName(category)} ${category}`;
    document.getElementById('currentCategoryTitle').textContent =
      subgroup === OTHER_SUBGROUP_LABEL ? '📄 Boshqalar' : `📁 ${subgroup}`;
    document.getElementById('deleteCategoryBtn').classList.add('hidden');
    renderProductList();
  }

  function showSearchResults(q) {
    currentFilter = { type: 'search', q };
    resetProductForm();
    productForm.classList.add('hidden');
    document.getElementById('subgroupGridView').classList.add('hidden');
    document.getElementById('productTableWrap').classList.remove('hidden');
    setListVisible(true);
    document.getElementById('categoryContext').textContent = '';
    document.getElementById('currentCategoryTitle').textContent = `🔍 Qidiruv natijasi: "${q}"`;
    document.getElementById('deleteCategoryBtn').classList.add('hidden');
    renderProductList();
  }

  document.getElementById('backToCategories').addEventListener('click', () => {
    if (currentFilter.type === 'subgroup') {
      openCategory(currentFilter.category);
    } else {
      showGridView();
    }
  });

  // ---------- "+ Mahsulot qo'shish" (kategoriya/guruh ichidan) ----------
  function openAddProductForm(presetCategory, presetSubgroup) {
    resetProductForm();
    if (presetCategory) {
      document.getElementById('p_kategoriya').value = presetCategory;
      updateSubgroupDatalist(presetCategory);
    }
    if (presetSubgroup) document.getElementById('p_ichki_guruh').value = presetSubgroup;
    productForm.classList.remove('hidden');
    productForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  document.getElementById('showAddProductForm').addEventListener('click', () => {
    if (currentFilter.type === 'subgroup') {
      const presetCategory = currentFilter.category !== NO_CATEGORY_LABEL ? currentFilter.category : '';
      const presetSubgroup = currentFilter.name !== OTHER_SUBGROUP_LABEL ? currentFilter.name : '';
      openAddProductForm(presetCategory, presetSubgroup);
    } else if (currentFilter.type === 'category' && currentFilter.name !== NO_CATEGORY_LABEL) {
      openAddProductForm(currentFilter.name, '');
    } else {
      openAddProductForm('', '');
    }
  });

  function updateSubgroupDatalist(categoryName) {
    const datalist = document.getElementById('subgroupDatalist');
    if (!categoryName) {
      datalist.innerHTML = '';
      return;
    }
    const names = [
      ...new Set(
        allProductsCache
          .filter((p) => p.kategoriya === categoryName && p.ichki_guruh)
          .map((p) => p.ichki_guruh)
      ),
    ].sort((a, b) => a.localeCompare(b, 'uz'));
    datalist.innerHTML = names.map((n) => `<option value="${escapeHtml(n)}"></option>`).join('');
  }

  // ---------- Yangi kategoriya yaratish / tahrirlash ----------
  let editingCategoryId = null;
  let newCategoryImageData = null;

  const newcatRasmFileInput = document.getElementById('newcat_rasm_file');
  const newcatRasmCameraInput = document.getElementById('newcat_rasm_camera');
  const newcatRasmPreview = document.getElementById('newcat_rasm_preview');

  function renderNewCategoryImagePreview() {
    newcatRasmPreview.innerHTML = newCategoryImageData
      ? `<img src="${newCategoryImageData}" alt="Kategoriya rasmi" style="width:100%;height:100%;object-fit:cover" />`
      : `<svg viewBox="0 0 120 120" width="36" height="36"><path d="M20 42 L46 42 L54 32 L100 32 L100 90 L20 90 Z" fill="#9ca3af"/></svg>`;
  }

  async function handlePickedCategoryImage(inputEl) {
    const file = inputEl.files && inputEl.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showToast('Faqat rasm fayli tanlang', 'error');
      inputEl.value = '';
      return;
    }
    try {
      newCategoryImageData = await fileToResizedDataUrl(file);
      renderNewCategoryImagePreview();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      inputEl.value = '';
    }
  }

  document.getElementById('newcat_rasm_pick_file').addEventListener('click', () => newcatRasmFileInput.click());
  document.getElementById('newcat_rasm_pick_camera').addEventListener('click', () => newcatRasmCameraInput.click());
  newcatRasmFileInput.addEventListener('change', () => handlePickedCategoryImage(newcatRasmFileInput));
  newcatRasmCameraInput.addEventListener('change', () => handlePickedCategoryImage(newcatRasmCameraInput));
  document.getElementById('newcat_rasm_clear').addEventListener('click', () => {
    newCategoryImageData = null;
    renderNewCategoryImagePreview();
  });

  function renderIconPicker() {
    const box = document.getElementById('newCategoryIconPicker');
    box.innerHTML = CATEGORY_ICON_CHOICES.map(
      (ic) => `<button type="button" data-icon="${ic}" class="${ic === selectedNewIcon ? 'active' : ''}">${ic}</button>`
    ).join('');
    box.querySelectorAll('button').forEach((btn) => {
      btn.addEventListener('click', () => {
        selectedNewIcon = btn.dataset.icon;
        box.querySelectorAll('button').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });
  }

  function showNewCategoryBox() {
    editingCategoryId = null;
    document.getElementById('newCategoryTitle').textContent = 'Yangi kategoriya';
    document.getElementById('newCategorySave').textContent = 'Yaratish';
    document.getElementById('newCategoryName').value = '';
    document.getElementById('newCategoryError').classList.remove('show');
    newCategoryImageData = null;
    renderNewCategoryImagePreview();
    selectedNewIcon = CATEGORY_ICON_CHOICES[0];
    renderIconPicker();
    document.getElementById('newCategoryBox').classList.remove('hidden');
    document.getElementById('newCategoryName').focus();
  }

  function showEditCategoryBox(cat) {
    editingCategoryId = cat.id;
    document.getElementById('newCategoryTitle').textContent = 'Kategoriyani tahrirlash';
    document.getElementById('newCategorySave').textContent = 'Saqlash';
    document.getElementById('newCategoryName').value = cat.nomi;
    document.getElementById('newCategoryError').classList.remove('show');
    newCategoryImageData = cat.rasm || null;
    renderNewCategoryImagePreview();
    selectedNewIcon = cat.icon || CATEGORY_ICON_CHOICES[0];
    renderIconPicker();
    document.getElementById('newCategoryBox').classList.remove('hidden');
    document.getElementById('newCategoryBox').scrollIntoView({ behavior: 'smooth', block: 'start' });
    document.getElementById('newCategoryName').focus();
  }

  function hideNewCategoryBox() {
    document.getElementById('newCategoryBox').classList.add('hidden');
    editingCategoryId = null;
  }

  document.getElementById('newCategoryCancel').addEventListener('click', hideNewCategoryBox);

  document.getElementById('newCategorySave').addEventListener('click', async () => {
    const nameInput = document.getElementById('newCategoryName');
    const errBox = document.getElementById('newCategoryError');
    errBox.classList.remove('show');
    const name = nameInput.value.trim();
    if (!name) {
      errBox.textContent = 'Kategoriya nomini kiriting';
      errBox.classList.add('show');
      return;
    }
    const payload = { nomi: name, icon: selectedNewIcon, rasm: newCategoryImageData };
    try {
      if (editingCategoryId) {
        const oldName = categoriesCache.find((c) => c.id === editingCategoryId)?.nomi;
        await api(`/categories/${editingCategoryId}`, { method: 'PUT', body: JSON.stringify(payload) });
        hideNewCategoryBox();
        showToast('Kategoriya yangilandi');
        await refreshProductsSection();
        if (currentFilter.type === 'category' && currentFilter.name === oldName) {
          openCategory(name);
        }
      } else {
        await api('/categories', { method: 'POST', body: JSON.stringify(payload) });
        hideNewCategoryBox();
        showToast('Kategoriya yaratildi');
        await refreshProductsSection();
        openCategory(name);
        openAddProductForm(name);
      }
    } catch (err) {
      errBox.textContent = err.message;
      errBox.classList.add('show');
    }
  });

  function filteredProducts() {
    if (currentFilter.type === 'category') {
      return itemsInCategory(currentFilter.name);
    }
    if (currentFilter.type === 'subgroup') {
      const inCat = itemsInCategory(currentFilter.category);
      return currentFilter.name === OTHER_SUBGROUP_LABEL
        ? inCat.filter((p) => !p.ichki_guruh)
        : inCat.filter((p) => p.ichki_guruh === currentFilter.name);
    }
    if (currentFilter.type === 'search') {
      const q = currentFilter.q.toLowerCase();
      return allProductsCache.filter(
        (p) =>
          p.nomi.toLowerCase().includes(q) ||
          (p.kategoriya || '').toLowerCase().includes(q) ||
          (p.ichki_guruh || '').toLowerCase().includes(q)
      );
    }
    return [];
  }

  function renderProductList() {
    const grid = document.getElementById('productsBody');
    const items = filteredProducts();

    if (!items.length) {
      grid.innerHTML = `<p style="color:#6b7280">Mahsulot topilmadi</p>`;
      return;
    }

    grid.innerHTML = items
      .map((p) => {
        const foyda = p.sotish_narxi - p.tannarx;
        const stockBadge =
          p.miqdor <= p.min_miqdor
            ? `<span class="badge low-stock">Qoldiq: ${p.miqdor}</span>`
            : `<span class="badge ok-stock">Qoldiq: ${p.miqdor}</span>`;
        const photo = p.rasm
          ? `<img src="${p.rasm}" alt="${escapeHtml(p.nomi)}" />`
          : `<div class="placeholder">📦</div>`;
        return `
        <div class="product-card admin-card">
          <div class="product-card-photo">
            <div class="product-card-stock-badge">${stockBadge}</div>
            ${photo}
          </div>
          <div class="product-card-body">
            <div class="product-card-name">${escapeHtml(p.nomi)}</div>
            <div class="product-card-tags">
              ${p.kategoriya ? `<span class="product-card-tag">${escapeHtml(p.kategoriya)}</span>` : ''}
              ${p.ichki_guruh ? `<span class="product-card-tag">${escapeHtml(p.ichki_guruh)}</span>` : ''}
            </div>
            <div class="price-rows">
              <div class="price-row"><span class="label">Tannarx</span><span class="val">${pul(p.tannarx)}</span></div>
              <div class="price-row"><span class="label">Sotish narxi</span><span class="val sell">${pul(p.sotish_narxi)}</span></div>
              <div class="price-row"><span class="label">Foyda/dona</span><span class="val profit">${pul(foyda)}</span></div>
            </div>
            <div class="product-card-actions">
              <button class="btn-sm btn-secondary" data-edit="${p.id}">Tahrirlash</button>
              <button class="btn-sm btn-danger" data-del="${p.id}">O'chirish</button>
            </div>
          </div>
        </div>`;
      })
      .join('');

    grid.querySelectorAll('[data-edit]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const p = allProductsCache.find((x) => x.id === Number(btn.dataset.edit));
        if (p) fillProductForm(p);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    });
    grid.querySelectorAll('[data-del]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (!confirm("Mahsulotni o'chirishni tasdiqlaysizmi?")) return;
        try {
          await api(`/products/${btn.dataset.del}`, { method: 'DELETE' });
          showToast("Mahsulot o'chirildi");
          await refreshProductsSection();
          await loadLowStock();
        } catch (err) {
          showToast(err.message, 'error');
        }
      });
    });
  }

  function updateCategoryDatalist() {
    const datalist = document.getElementById('categoryDatalist');
    datalist.innerHTML = categoriesCache.map((c) => `<option value="${escapeHtml(c.nomi)}"></option>`).join('');
  }

  async function refreshProductsSection() {
    const [productsData, categoriesData] = await Promise.all([api('/products'), api('/categories')]);
    allProductsCache = productsData.products;
    categoriesCache = categoriesData.categories;
    updateCategoryDatalist();

    if (currentFilter.type === 'grid') {
      setListVisible(false);
      renderCategoryGrid();
      return;
    }
    if (currentFilter.type === 'category') {
      // "Kategoriyasiz" faqat mahsulot bo'lsa mavjud bo'ladi — bo'shab qolsa panjaraga qaytamiz.
      // Haqiqiy kategoriyalar esa mahsulotsiz ham mavjud bo'lishi mumkin, shuning uchun ro'yxatda qolaveradi.
      if (currentFilter.name === NO_CATEGORY_LABEL && filteredProducts().length === 0) {
        showGridView();
        return;
      }
      renderCategoryLevel();
      return;
    }
    if (currentFilter.type === 'subgroup') {
      const stillHasSubgroups = itemsInCategory(currentFilter.category).some((p) => p.ichki_guruh);
      if (!stillHasSubgroups) {
        openCategory(currentFilter.category);
        return;
      }
      renderProductList();
      return;
    }
    renderProductList();
  }

  let searchTimer = null;
  document.getElementById('productSearch').addEventListener('input', (e) => {
    clearTimeout(searchTimer);
    const q = e.target.value.trim();
    searchTimer = setTimeout(() => {
      if (q) {
        showSearchResults(q);
      } else if (currentFilter.type !== 'grid') {
        showGridView();
      }
    }, 250);
  });

  // ==================================================
  // FOYDALANUVCHILAR (Sotuvchilar)
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
    document.getElementById('parolHint').textContent = '(bo\'sh qoldirsangiz o\'zgarmaydi)';
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
    } catch (err) {
      userError.textContent = err.message;
      userError.classList.add('show');
    }
  });

  async function loadUsers() {
    const data = await api('/users');
    const body = document.getElementById('usersBody');
    body.innerHTML = data.users
      .map((u) => {
        const tegishOlmasin = u.rol === 'dev' && user.rol !== 'dev';
        return `
        <tr>
          <td>${escapeHtml(u.ism)}</td>
          <td>${escapeHtml(u.login)}</td>
          <td><span class="badge ${u.rol}">${u.rol}</span></td>
          <td>${sanaFormat(u.created_at)}</td>
          <td class="actions-cell">
            ${
              tegishOlmasin
                ? '<span style="color:var(--muted); font-size:12px">Tizim egasi</span>'
                : `<button class="btn-sm btn-secondary" data-edit="${u.id}">Tahrirlash</button>
                   <button class="btn-sm btn-danger" data-del="${u.id}">O'chirish</button>`
            }
          </td>
        </tr>`;
      })
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
        } catch (err) {
          showToast(err.message, 'error');
        }
      });
    });
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str ?? '';
    return div.innerHTML;
  }

  // ---------- Boshlash ----------
  refreshDashboard();
  refreshProductsSection();
  loadUsers();
})();
