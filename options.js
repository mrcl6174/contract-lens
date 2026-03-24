'use strict';

document.addEventListener('DOMContentLoaded', async () => {
  const apiKeyInput = document.getElementById('apiKeyInput');
  const saveBtn = document.getElementById('saveBtn');
  const clearBtn = document.getElementById('clearBtn');
  const toggleBtn = document.getElementById('toggleVisibility');
  const saveStatus = document.getElementById('saveStatus');

  // Load saved API key
  const result = await chrome.storage.local.get('apiKey');
  if (result.apiKey) {
    apiKeyInput.value = result.apiKey;
  }

  // Toggle visibility
  toggleBtn.addEventListener('click', () => {
    const isPassword = apiKeyInput.type === 'password';
    apiKeyInput.type = isPassword ? 'text' : 'password';
    toggleBtn.querySelector('svg').innerHTML = isPassword
      ? `<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
       <line x1="1" y1="1" x2="23" y2="23"/>`
      : `<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
         <circle cx="12" cy="12" r="3"/>`;
  });

  // Save
  saveBtn.addEventListener('click', async () => {
    const key = apiKeyInput.value.trim();

    if (!key) {
      showStatus('APIキーを入力してください', 'error');
      return;
    }

    if (!key.startsWith('AIza')) {
      showStatus('有効なGemini APIキーを入力してください（AIza...）', 'error');
      return;
    }

    await chrome.storage.local.set({ apiKey: key });
    showStatus('✓ 保存しました', 'success');
  });

  // Clear
  clearBtn.addEventListener('click', async () => {
    if (!confirm('APIキーを削除してもよろしいですか？')) return;
    await chrome.storage.local.remove('apiKey');
    apiKeyInput.value = '';
    showStatus('削除しました', 'success');
  });

  function showStatus(message, type) {
    saveStatus.textContent = message;
    saveStatus.className = `save-status ${type}`;
    setTimeout(() => {
      saveStatus.textContent = '';
      saveStatus.className = 'save-status';
    }, 3000);
  }
});
