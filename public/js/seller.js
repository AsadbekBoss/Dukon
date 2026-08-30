(function () {
  const user = requireRoleOrRedirect('sotuvchi');
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
      if (btn.dataset.tab === 'mysales') loadMySales(currentPeriod);
    });
  });

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str ?? '';
    return div.innerHTML;
  }

  // ==================================================
  // CHEK CHOP ETISH
  // ==================================================
  function printReceipt(sale) {
    const receiptArea = document.getElementById('receiptArea');
    receiptArea.innerHTML = `
      <div class="receipt">
        <h3>Do'kon cheki</h3>
        <div class="sub-center">${sanaFormat(sale.sana)}</div>
        <div class="dashed"></div>
        <div class="row"><span>${escapeHtml(sale.mahsulot_nomi)}</span></div>
        <div class="row"><span>${sale.miqdor} dona x ${pul(sale.narx_dona)}</span></div>
        <div class="dashed"></div>
        <div class="row total"><span>Jami:</span><span>${pul(sale.jami_summa)}</span></div>
        <div class="dashed"></div>
        <div class="row"><span>Sotuvchi:</span><span>${escapeHtml(sale.sotuvchi_ismi)}</span></div>
        <div class="thanks">Xaridingiz uchun rahmat!</div>
      </div>
    `;
    document.body.classList.add('printing-receipt');
    window.print();
  }

  function printCombinedReceipt(sales) {
    const receiptArea = document.getElementById('receiptArea');
    const jami = sales.reduce((s, r) => s + r.jami_summa, 0);
    const itemsHtml = sales
      .map(
        (s) => `
        <div class="row"><span>${escapeHtml(s.mahsulot_nomi)}</span></div>
        <div class="row"><span>${s.miqdor} dona x ${pul(s.narx_dona)}</span><span>${pul(s.jami_summa)}</span></div>`
      )
      .join('<div class="dashed"></div>');
    receiptArea.innerHTML = `
      <div class="receipt">
        <h3>Do'kon cheki</h3>
        <div class="sub-center">${sanaFormat(sales[0].sana)}</div>
        <div class="dashed"></div>
        ${itemsHtml}
        <div class="dashed"></div>
        <div class="row total"><span>Jami:</span><span>${pul(jami)}</span></div>
        <div class="dashed"></div>
        <div class="row"><span>Sotuvchi:</span><span>${escapeHtml(sales[0].sotuvchi_ismi)}</span></div>
        <div class="thanks">Xaridingiz uchun rahmat!</div>
      </div>
    `;
    document.body.classList.add('printing-receipt');
    window.print();
  }

  window.addEventListener('afterprint', () => {
    document.body.classList.remove('printing-receipt');
  });

  // ==================================================
  // SAVAT (bir nechta mahsulotni bitta xaridorga birga sotish)
  // ==================================================
  let cart = []; // { product_id, nomi, kategoriya, sotish_narxi, miqdor, maxStock }
  let productsCache = [];

  function addToCart(product, miqdor) {
    const existing = cart.find((c) => c.product_id === product.id);
    const already = existing ? existing.miqdor : 0;
    const yangiMiqdor = Math.min(already + miqdor, product.miqdor);
    if (yangiMiqdor <= already) {
      showToast("Omborda ko'proq mahsulot yo'q", 'error');
      return;
    }
    if (existing) {
      existing.miqdor = yangiMiqdor;
    } else {
      cart.push({
        product_id: product.id,
        nomi: product.nomi,
        kategoriya: product.kategoriya,
        sotish_narxi: product.sotish_narxi,
        miqdor: yangiMiqdor,
        maxStock: product.miqdor,
      });
    }
    renderCart();
    showToast(`"${product.nomi}" savatga qo'shildi`);
  }

  function changeCartQty(productId, delta) {
    const line = cart.find((c) => c.product_id === productId);
    if (!line) return;
    const yangi = line.miqdor + delta;
    if (yangi <= 0) {
      cart = cart.filter((c) => c.product_id !== productId);
    } else if (yangi <= line.maxStock) {
      line.miqdor = yangi;
    }
    renderCart();
  }

  function removeFromCart(productId) {
    cart = cart.filter((c) => c.product_id !== productId);
    renderCart();
  }

  function renderCart() {
    const bar = document.getElementById('cartBar');
    const panel = document.getElementById('cartPanel');
    const summary = document.getElementById('cartBarSummary');
    const list = document.getElementById('cartItemsList');

    if (!cart.length) {
      bar.classList.add('hidden');
      panel.classList.add('hidden');
      document.body.classList.remove('has-cart');
      return;
    }

    document.body.classList.add('has-cart');
    bar.classList.remove('hidden');

    const jami = cart.reduce((s, c) => s + c.miqdor * c.sotish_narxi, 0);
    const donaSoni = cart.reduce((s, c) => s + c.miqdor, 0);
    summary.innerHTML = `<strong>${pul(jami)}</strong>${cart.length} tur, ${donaSoni} dona`;

    list.innerHTML = cart
      .map(
        (c) => `
        <div class="cart-item-row">
          <div class="cart-item-name">${escapeHtml(c.nomi)}<span class="cat">${escapeHtml(c.kategoriya || '-')}</span></div>
          <div class="cart-item-qty">
            <button type="button" data-qty-minus="${c.product_id}">−</button>
            <span>${c.miqdor}</span>
            <button type="button" data-qty-plus="${c.product_id}" ${c.miqdor >= c.maxStock ? 'disabled' : ''}>+</button>
          </div>
          <div class="cart-item-total">${pul(c.miqdor * c.sotish_narxi)}</div>
          <button type="button" class="cart-item-remove" data-remove="${c.product_id}" title="O'chirish">×</button>
        </div>`
      )
      .join('');

    list.querySelectorAll('[data-qty-minus]').forEach((b) => {
      b.addEventListener('click', () => changeCartQty(Number(b.dataset.qtyMinus), -1));
    });
    list.querySelectorAll('[data-qty-plus]').forEach((b) => {
      b.addEventListener('click', () => changeCartQty(Number(b.dataset.qtyPlus), 1));
    });
    list.querySelectorAll('[data-remove]').forEach((b) => {
      b.addEventListener('click', () => removeFromCart(Number(b.dataset.remove)));
    });
  }

  document.getElementById('cartToggleBtn').addEventListener('click', () => {
    document.getElementById('cartPanel').classList.toggle('hidden');
  });

  document.getElementById('cartClearBtn').addEventListener('click', () => {
    cart = [];
    renderCart();
  });

  document.getElementById('cartCheckoutBtn').addEventListener('click', async () => {
    if (!cart.length) return;
    const btn = document.getElementById('cartCheckoutBtn');
    btn.disabled = true;
    try {
      const items = cart.map((c) => ({ product_id: c.product_id, miqdor: c.miqdor }));
      const res = await api('/sales/batch', { method: 'POST', body: JSON.stringify({ items }) });
      showToast(`Sotuv yakunlandi: jami ${pul(res.jami_summa)}`);
      cart = [];
      renderCart();
      document.getElementById('cartPanel').classList.add('hidden');
      await loadProducts();
      loadFrequentlySold().catch(console.error);
      printCombinedReceipt(res.sales);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      btn.disabled = false;
    }
  });

  // ==================================================
  // SOTUV QILISH
  // ==================================================
  const saleErr = document.getElementById('saleErr');

  function currentProductFilters() {
    return {
      q: document.getElementById('productSearch').value.trim(),
      category: document.getElementById('productCategoryFilter').value,
    };
  }

  async function loadProducts() {
    const { q, category } = currentProductFilters();
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (category) params.set('category', category);
    const query = params.toString() ? `?${params.toString()}` : '';

    const data = await api(`/products${query}`);
    productsCache = data.products;
    const grid = document.getElementById('productsGrid');
    if (!data.products.length) {
      grid.innerHTML = `<p style="color:#6b7280">Mahsulot topilmadi</p>`;
      return;
    }
    grid.innerHTML = data.products
      .map((p) => {
        const stockBadge =
          p.miqdor <= p.min_miqdor
            ? `<span class="badge low-stock">Qoldiq: ${p.miqdor}</span>`
            : `<span class="badge ok-stock">Qoldiq: ${p.miqdor}</span>`;
        const photo = p.rasm
          ? `<img src="${p.rasm}" alt="${escapeHtml(p.nomi)}" />`
          : `<div class="placeholder">📦</div>`;
        return `
        <div class="product-card">
          <div class="product-card-photo">
            <div class="product-card-stock-badge">${stockBadge}</div>
            ${photo}
          </div>
          <div class="product-card-body">
            <div class="product-card-price">${pul(p.sotish_narxi)}</div>
            <div class="product-card-name">${escapeHtml(p.nomi)}</div>
            <div class="product-card-tags">
              ${p.kategoriya ? `<span class="product-card-tag">${escapeHtml(p.kategoriya)}</span>` : ''}
              ${p.ichki_guruh ? `<span class="product-card-tag">${escapeHtml(p.ichki_guruh)}</span>` : ''}
            </div>
            <div class="product-card-actions">
              <input type="number" class="qty-input" min="1" max="${p.miqdor}" value="1" ${p.miqdor === 0 ? 'disabled' : ''} data-qty="${p.id}" />
              <button class="btn-sm" data-add-to-cart="${p.id}" ${p.miqdor === 0 ? 'disabled' : ''}>🛒 Qo'shish</button>
            </div>
          </div>
        </div>`;
      })
      .join('');

    grid.querySelectorAll('[data-add-to-cart]').forEach((btn) => {
      btn.addEventListener('click', () => {
        saleErr.classList.remove('show');
        const pid = Number(btn.dataset.addToCart);
        const qtyInput = grid.querySelector(`[data-qty="${pid}"]`);
        const miqdor = Number(qtyInput.value);
        if (!miqdor || miqdor <= 0) {
          saleErr.textContent = "Miqdorni to'g'ri kiriting";
          saleErr.classList.add('show');
          return;
        }
        const product = productsCache.find((p) => p.id === pid);
        if (product) addToCart(product, miqdor);
      });
    });
  }

  // Sotuvchining o'zi eng ko'p sotgan mahsulotlarini tezkor panelga chiqaradi —
  // qidiruv yoki kategoriya ichiga kirmasdan bir bosishda savatga qo'shish uchun
  async function loadFrequentlySold() {
    const data = await api('/sales/mine');
    const totals = new Map(); // product_id -> jami sotilgan soni

    for (const s of data.sales) {
      if (!s.product_id) continue;
      totals.set(s.product_id, (totals.get(s.product_id) || 0) + s.miqdor);
    }

    const top = [...totals.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([pid, soni]) => {
        const product = productsCache.find((p) => p.id === pid);
        return product && product.miqdor > 0 ? { product, soni } : null;
      })
      .filter(Boolean);

    const section = document.getElementById('frequentSection');
    const row = document.getElementById('frequentRow');

    if (!top.length) {
      section.classList.add('hidden');
      return;
    }

    section.classList.remove('hidden');
    row.innerHTML = top
      .map(({ product: p, soni }) => {
        const photo = p.rasm
          ? `<img class="thumb" src="${p.rasm}" alt="${escapeHtml(p.nomi)}" />`
          : `<div class="thumb-placeholder">📦</div>`;
        return `
        <div class="frequent-chip" data-freq-add="${p.id}">
          ${photo}
          <div class="name">${escapeHtml(p.nomi)}</div>
          <div class="price">${pul(p.sotish_narxi)}</div>
          <div class="soni-badge">${soni} marta sotilgan</div>
        </div>`;
      })
      .join('');

    row.querySelectorAll('[data-freq-add]').forEach((el) => {
      el.addEventListener('click', () => {
        const pid = Number(el.dataset.freqAdd);
        const product = productsCache.find((p) => p.id === pid);
        if (product) addToCart(product, 1);
      });
    });
  }

  async function loadCategories() {
    const data = await api('/products/meta/categories');
    const select = document.getElementById('productCategoryFilter');
    const current = select.value;
    select.innerHTML =
      '<option value="">Barcha kategoriyalar</option>' +
      data.categories.map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
    if (data.categories.includes(current)) select.value = current;
  }

  let searchTimer = null;
  document.getElementById('productSearch').addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => loadProducts(), 250);
  });
  document.getElementById('productCategoryFilter').addEventListener('change', () => loadProducts());

  document.getElementById('scanBarcodeBtn').addEventListener('click', () => {
    openBarcodeScanner(async (code) => {
      try {
        const data = await api(`/products/barcode/${encodeURIComponent(code)}`);
        document.getElementById('productSearch').value = data.product.nomi;
        document.getElementById('productCategoryFilter').value = '';
        await loadProducts();
        showToast(`Topildi: ${data.product.nomi}`);
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  });

  // ==================================================
  // MENING SOTUVLARIM
  // ==================================================
  let currentPeriod = 'today';

  document.querySelectorAll('[data-target="my-period"] button').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-target="my-period"] button').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      currentPeriod = btn.dataset.period;
      loadMySales(currentPeriod);
    });
  });

  async function loadMySales(period) {
    const q = period && period !== 'all' ? `?period=${period}` : '';
    const data = await api(`/sales/mine${q}`);

    const grid = document.getElementById('mySummaryGrid');
    grid.innerHTML = `
      <div class="stat-card">
        <div class="stat-icon">💰</div>
        <div>
          <div class="label">Jami tushum</div>
          <div class="value">${pul(data.jami_summa)}</div>
          <div class="sub">${data.soni} ta sotuv</div>
        </div>
      </div>
    `;

    const body = document.getElementById('mySalesBody');
    if (!data.sales.length) {
      body.innerHTML = `<tr><td colspan="6" style="color:#6b7280">Sotuvlar topilmadi</td></tr>`;
      return;
    }
    body.innerHTML = data.sales
      .map(
        (s) => `
        <tr>
          <td>${sanaFormat(s.sana)}</td>
          <td>${escapeHtml(s.mahsulot_nomi)}</td>
          <td>${s.miqdor}</td>
          <td>${pul(s.narx_dona)}</td>
          <td>${pul(s.jami_summa)}</td>
          <td><button type="button" class="btn-sm btn-secondary" data-print="${s.id}">🖨️</button></td>
        </tr>`
      )
      .join('');

    body.querySelectorAll('[data-print]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const sale = data.sales.find((x) => x.id === Number(btn.dataset.print));
        if (sale) printReceipt(sale);
      });
    });
  }

  document.getElementById('exportMySalesCsv').addEventListener('click', async () => {
    try {
      const q = currentPeriod !== 'all' ? `?period=${currentPeriod}` : '';
      await downloadCsv(`/sales/mine/export/csv${q}`, 'mening-sotuvlarim.csv');
      showToast('CSV yuklandi');
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  // ---------- Boshlash ----------
  (async () => {
    await loadProducts();
    loadFrequentlySold().catch(console.error);
  })();
  loadCategories();
  loadMySales(currentPeriod);
})();
