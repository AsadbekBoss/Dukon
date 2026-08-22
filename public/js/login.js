(function () {
  const existing = getUser();
  const existingToken = getToken();
  if (existing && existingToken) {
    window.location.href = existing.rol === 'admin' ? '/admin.html' : '/seller.html';
    return;
  }

  const form = document.getElementById('loginForm');
  const errorBox = document.getElementById('errorBox');
  const submitBtn = document.getElementById('submitBtn');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorBox.classList.remove('show');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Kirilmoqda...';

    const login = document.getElementById('login').value.trim();
    const parol = document.getElementById('parol').value;

    try {
      const data = await api('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ login, parol }),
      });
      setSession(data.token, data.user);
      window.location.href = data.user.rol === 'admin' ? '/admin.html' : '/seller.html';
    } catch (err) {
      errorBox.textContent = err.message;
      errorBox.classList.add('show');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Kirish';
    }
  });
})();
