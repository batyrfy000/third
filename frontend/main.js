const API = 'https://third-bfwa.onrender.com';
let token = '';
let currentUserId = null;
let currentUsername = '';
let selectedUserId = null;
let selectedUsername = '';
let allUsers = []; // Для локального поиска
let chatUpdateInterval = null;
let lastMessages = [];

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  const savedToken = localStorage.getItem('token');
  if (savedToken) {
    try {
      token = savedToken;
      const payload = parseJwt(token);
      currentUserId = payload.sub;
      currentUsername = payload.username || localStorage.getItem('username');
      initChat();
    } catch (error) {
      console.error('Invalid token:', error);
      logout();
    }
  }

  // Setup search
  const searchInput = document.getElementById('searchInput');
  searchInput.addEventListener('input', debounce(searchUsers, 300));

  // Аварийная проверка: если оба блока скрыты, показываем authSection
  setTimeout(() => {
    const auth = document.getElementById('authSection');
    const chat = document.getElementById('chatSection');
    if (getComputedStyle(auth).display === 'none' && getComputedStyle(chat).display === 'none') {
      auth.classList.remove('hidden');
      auth.style.display = 'block';
    }
  }, 1000);
});

function parseJwt(token) {
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(base64));
  } catch {
    return {};
  }
}

function getAvatarText(username) {
  return username ? username.charAt(0).toUpperCase() : '';
}

function switchTab(tab) {
  document.querySelectorAll('.auth-tab').forEach(t => {
    t.classList.remove('active');
    t.setAttribute('aria-selected', 'false');
  });
  document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
  
  if (tab === 'login') {
    document.querySelector('.auth-tab:nth-child(1)').classList.add('active');
    document.querySelector('.auth-tab:nth-child(1)').setAttribute('aria-selected', 'true');
    document.getElementById('loginForm').classList.add('active');
  } else {
    document.querySelector('.auth-tab:nth-child(2)').classList.add('active');
    document.querySelector('.auth-tab:nth-child(2)').setAttribute('aria-selected', 'true');
    document.getElementById('registerForm').classList.add('active');
  }
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('active');
}

function logout() {
  token = '';
  currentUserId = null;
  currentUsername = '';
  selectedUserId = null;
  selectedUsername = '';
  localStorage.removeItem('token');
  localStorage.removeItem('username');
  document.getElementById('chatSection').classList.add('hidden');
  document.getElementById('authSection').classList.remove('hidden');
  if (chatUpdateInterval) {
    clearInterval(chatUpdateInterval);
    chatUpdateInterval = null;
  }
  lastMessages = [];
}

function debounce(func, wait) {
  let timeout;
  return function (...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

function searchUsers() {
  const query = document.getElementById('searchInput').value.trim().toLowerCase();
  renderUsers(query ? allUsers.filter(u => u.username.toLowerCase().includes(query)) : allUsers);
}

async function register() {
  const username = document.getElementById('regUsername').value.trim();
  const password = document.getElementById('regPassword').value;

  if (!username || !password) {
    showMessage('Заполните все поля');
    return;
  }

  try {
    showLoading();
    const res = await fetch(`${API}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    if (res.ok) {
      showMessage('Регистрация успешна! Войдите в аккаунт.', 'success');
      switchTab('login');
      document.getElementById('loginUsername').value = username;
      document.getElementById('loginPassword').value = '';
    } else {
      const error = await res.json();
      showMessage(error.detail || 'Ошибка регистрации');
    }
  } catch (error) {
    console.error('Registration error:', error);
    showMessage('Ошибка сети: ' + error.message);
  } finally {
    hideLoading();
  }
}

async function login() {
  const username = document.getElementById('loginUsername').value.trim();
  const password = document.getElementById('loginPassword').value;

  if (!username || !password) {
    showMessage('Заполните все поля');
    return;
  }

  try {
    showLoading();
    console.log('[login] Отправка запроса на /login', username);
    const form = new URLSearchParams();
    form.append('username', username);
    form.append('password', password);

    const res = await fetch(`${API}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form
    });

    const data = await res.json();
    console.log('[login] Ответ от /login:', data);
    if (res.ok && data.access_token) {
      token = data.access_token;
      localStorage.setItem('token', token);
      localStorage.setItem('username', username);
      const payload = parseJwt(token);
      currentUserId = payload.sub;
      currentUsername = username;
      console.log('[login] Успешный вход, currentUserId:', currentUserId, 'currentUsername:', currentUsername);
      initChat();
    } else {
      showMessage(data.detail || 'Ошибка входа');
    }
  } catch (error) {
    console.error('[login] Login error:', error);
    showMessage('Ошибка сети: ' + error.message);
  } finally {
    hideLoading();
  }
}

function initChat() {
  try {
    console.log('[initChat] Запуск');
    document.getElementById('authSection').classList.add('hidden');
    document.getElementById('chatSection').classList.remove('hidden');
    document.getElementById('chatSection').style.display = 'block';
    document.getElementById('currentUser').textContent = currentUsername;
    document.getElementById('userAvatar').textContent = getAvatarText(currentUsername);
    loadUsers();
    const textarea = document.getElementById('msgInput');
    textarea.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });
    textarea.addEventListener('input', () => {
      textarea.style.height = 'auto';
      textarea.style.height = `${textarea.scrollHeight}px`;
    });
  } catch (error) {
    console.error('[initChat] Ошибка:', error);
    showMessage('Ошибка инициализации чата');
    logout();
  }
}

async function loadUsers() {
  try {
    showLoading('#userList');
    console.log('[loadUsers] Запрос к /users');
    const res = await fetch(`${API}/users`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (res.ok) {
      allUsers = await res.json();
      console.log('[loadUsers] Получено пользователей:', allUsers);
      renderUsers(allUsers);
    } else {
      const err = await res.text();
      console.error('[loadUsers] Ошибка ответа:', res.status, err);
      throw new Error('Failed to load users');
    }
  } catch (error) {
    console.error('[loadUsers] Error loading users:', error);
    showMessage('Ошибка загрузки пользователей');
  } finally {
    hideLoading('#userList');
  }
}

function renderUsers(users) {
  console.log('[renderUsers] users:', users, 'currentUserId:', currentUserId);
  const userList = document.getElementById('userList');
  userList.innerHTML = '';
  users
    .filter(u => u.id !== currentUserId)
    .forEach(user => {
      const userItem = document.createElement('div');
      userItem.className = 'user-item';
      userItem.role = 'listitem';
      userItem.onclick = () => loadChat(user.id, user.username);
      const avatar = document.createElement('div');
      avatar.className = 'user-avatar';
      avatar.textContent = getAvatarText(user.username);
      const details = document.createElement('div');
      details.className = 'user-details';
      const name = document.createElement('h4');
      name.textContent = user.username;
      const status = document.createElement('p');
      status.textContent = 'Онлайн';
      status.className = 'text-muted';
      details.appendChild(name);
      details.appendChild(status);
      userItem.appendChild(avatar);
      userItem.appendChild(details);
      userList.appendChild(userItem);
    });
  console.log('[renderUsers] userList.innerHTML:', userList.innerHTML);
}

async function loadChat(userId, username, scrollToBottom = false) {
  selectedUserId = userId;
  selectedUsername = username;

  // Очищаем предыдущий интервал, если был
  if (chatUpdateInterval) {
    clearInterval(chatUpdateInterval);
    chatUpdateInterval = null;
  }

  try {
    document.getElementById('emptyState').classList.add('hidden');
    document.getElementById('chatContainer').classList.remove('hidden');

    document.getElementById('chatWith').textContent = username;
    document.getElementById('chatAvatar').textContent = getAvatarText(username);

    document.querySelectorAll('.user-item').forEach(item => {
      item.classList.remove('active');
      if (item.querySelector('h4').textContent === username) {
        item.classList.add('active');
      }
    });

    if (window.innerWidth <= 768) {
      document.getElementById('sidebar').classList.remove('active');
    }

    // Функция для загрузки сообщений (используется и для автообновления)
    async function fetchMessages(isFirst = false) {
      try {
        const res = await fetch(`${API}/messages/${userId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const messages = await res.json();
          // Сравниваем с предыдущими сообщениями
          if (isFirst || JSON.stringify(messages) !== JSON.stringify(lastMessages)) {
            lastMessages = messages;
            const chatMessages = document.getElementById('chatMessages');
            chatMessages.innerHTML = '';
            messages.forEach(msg => appendMessage(msg));
            if (scrollToBottom || isFirst) {
              chatMessages.scrollTop = chatMessages.scrollHeight;
            }
          }
        } else {
          throw new Error('Failed to load messages');
        }
      } catch (error) {
        if (isFirst) {
          showMessage('Ошибка загрузки чата');
        }
      }
    }

    // Первый раз загружаем с прокруткой вниз
    await fetchMessages(true);

    // Запускаем автообновление каждую секунду (без мерцания)
    chatUpdateInterval = setInterval(() => fetchMessages(false), 1000);

  } catch (error) {
    showMessage('Ошибка загрузки чата');
  }
}

function appendMessage(msg) {
  const isOutgoing = Number(msg.sender_id) === Number(currentUserId);
  const messageDiv = document.createElement('div');
  messageDiv.className = `message ${isOutgoing ? 'message-out' : 'message-in'}`;
  
  const contentDiv = document.createElement('div');
  contentDiv.textContent = msg.content;
  
  const timeDiv = document.createElement('div');
  timeDiv.className = 'message-time';
  timeDiv.textContent = formatTime(msg.timestamp);
  
  messageDiv.appendChild(contentDiv);
  messageDiv.appendChild(timeDiv);
  document.getElementById('chatMessages').appendChild(messageDiv);
}

function formatTime(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

async function sendMessage() {
  const input = document.getElementById('msgInput');
  const content = input.value.trim();
  
  if (!content || !selectedUserId) return;
  
  try {
    showLoading('#chatMessages');
    const res = await fetch(`${API}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ receiver_id: selectedUserId, content })
    });

    if (res.ok) {
      input.value = '';
      input.style.height = 'auto';
      await loadChat(selectedUserId, selectedUsername);
    } else {
      throw new Error('Failed to send message');
    }
  } catch (error) {
    console.error('Error sending message:', error);
    showMessage('Ошибка отправки сообщения');
  } finally {
    hideLoading('#chatMessages');
  }
}

function showMessage(message, type = 'error') {
  const div = document.createElement('div');
  div.className = `message message-${type}`;
  div.style.position = 'fixed';
  div.style.top = '20px';
  div.style.right = '20px';
  div.style.zIndex = '1000';
  div.style.padding = '1rem';
  div.style.backgroundColor = type === 'error' ? 'var(--danger)' : 'var(--success)';
  div.style.color = 'white';
  div.style.borderRadius = 'var(--radius-sm)';
  div.textContent = message;
  document.body.appendChild(div);
  setTimeout(() => div.remove(), 3000);
}

function showLoading(selector = 'body') {
  const container = document.querySelector(selector);
  if (!container) return;
  const loading = document.createElement('div');
  loading.className = 'loading';
  loading.innerHTML = '<div class="spinner"></div> Загрузка...';
  container.appendChild(loading);
}

function hideLoading(selector = 'body') {
  const container = document.querySelector(selector);
  if (!container) return;
  const loading = container.querySelector('.loading');
  if (loading) loading.remove();
} 
