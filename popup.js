'use strict';

// ==========================================
// State Management
// ==========================================
const state = {
  selectedPosition: '委託側',
  contractText: '',
  pdfData: null,   // base64エンコードされたPDFバイナリ
  isPdf: false,
  apiKey: '',
  isAnalyzing: false,
};

// ==========================================
// DOM References
// ==========================================
const dom = {
  inputSection: () => document.getElementById('inputSection'),
  loadingSection: () => document.getElementById('loadingSection'),
  resultsSection: () => document.getElementById('resultsSection'),
  contractText: () => document.getElementById('contractText'),
  charCount: () => document.getElementById('charCount'),
  textStatus: () => document.getElementById('textStatus'),
  analyzeBtn: () => document.getElementById('analyzeBtn'),
  apiWarning: () => document.getElementById('apiWarning'),
  overallScore: () => document.getElementById('overallScore'),
  scoreFill: () => document.getElementById('scoreFill'),
  scoreBadges: () => document.getElementById('scoreBadges'),
  summaryText: () => document.getElementById('summaryText'),
  categoriesContainer: () => document.getElementById('categoriesContainer'),
  dangerSection: () => document.getElementById('dangerSection'),
  dangerCount: () => document.getElementById('dangerCount'),
  dangerList: () => document.getElementById('dangerList'),
  pageFetchStatus: () => document.getElementById('pageFetchStatus'),
  pdfCard: () => document.getElementById('pdfCard'),
  pdfSize: () => document.getElementById('pdfSize'),
  textInfo: () => document.getElementById('textInfo'),
};

// ==========================================
// Initialization
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
  await loadApiKey();
  setupPositionTabs();
  setupTextInput();
  setupButtons();
  await fetchPageContent();
});

async function loadApiKey() {
  const result = await chrome.storage.local.get('apiKey');
  state.apiKey = result.apiKey || '';
  updateApiWarning();
}

function updateApiWarning() {
  const warning = dom.apiWarning();
  warning.style.display = state.apiKey ? 'none' : 'flex';
  updateAnalyzeButton();
}

function updateAnalyzeButton() {
  const btn = dom.analyzeBtn();
  const hasContent = state.isPdf ? !!state.pdfData : state.contractText.trim().length > 50;
  btn.disabled = !hasContent || !state.apiKey || state.isAnalyzing;
}

// ==========================================
// Page Content Fetch (起動時自動取得)
// PDF / 通常ページを自動判別
// ==========================================
async function fetchPageContent() {
  const statusEl = dom.pageFetchStatus();
  statusEl.textContent = 'ページからコンテンツを取得中...';
  statusEl.style.color = 'var(--text-muted)';

  // stateリセット
  state.isPdf = false;
  state.pdfData = null;
  state.contractText = '';
  dom.contractText().value = '';
  showPdfMode(false);

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const pdfUrl = detectPdfUrl(tab.url);

    if (pdfUrl) {
      await fetchPdfContent(tab, pdfUrl, statusEl);
    } else {
      await fetchTextContent(tab, statusEl);
    }
  } catch (err) {
    statusEl.textContent = `取得エラー: ${err.message} — テキストを直接貼り付けてください。`;
    statusEl.style.color = 'var(--status-warn)';
    console.error('fetchPageContent error:', err);
  }

  updateAnalyzeButton();
}

/**
 * URLがPDFを指しているか判定し、実際のPDF URLを返す
 * Chromeのビルトインビューア用URLも処理する
 */
function detectPdfUrl(url) {
  if (!url) return null;

  // Chrome組み込みPDFビューア: chrome-extension://..../index.html?src=https://...
  const chromeViewerMatch = url.match(/[?&]src=([^&]+)/);
  if (chromeViewerMatch) {
    const srcUrl = decodeURIComponent(chromeViewerMatch[1]);
    if (srcUrl.toLowerCase().includes('.pdf')) return srcUrl;
  }

  // 直接PDFのURL
  const lower = url.toLowerCase().split('?')[0].split('#')[0];
  if (lower.endsWith('.pdf')) return url;

  return null;
}

/**
 * PDF を background service worker 経由で取得する。
 *
 * PDF ビューアページは chrome-extension:// オリジンで動作するため、
 * そこから直接 fetch すると PDF サーバーへのリクエストがクロスオリジンになり
 * CORS で失敗する。background SW は host_permissions (<all_urls>) を持つため
 * CORS 制限なしで fetch できる。
 */
async function fetchPdfContent(tab, pdfUrl, statusEl) {
  statusEl.textContent = 'PDFを取得中...';

  const result = await chrome.runtime.sendMessage({
    action: 'fetchPdf',
    url: pdfUrl,
  });

  if (!result) throw new Error('バックグラウンドからの応答がありません');
  if (result.error) throw new Error(result.error);

  state.pdfData = result.base64;
  state.isPdf = true;

  const sizeKb = (result.size / 1024).toFixed(0);
  dom.pdfSize().textContent = `${Number(sizeKb).toLocaleString()} KB`;
  showPdfMode(true);

  statusEl.textContent = '✓ PDF取得完了';
  statusEl.style.color = 'var(--accent-teal)';
}

async function fetchTextContent(tab, statusEl) {
  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => {
      const body = document.body.cloneNode(true);
      body.querySelectorAll('script, style, nav, header, footer, [role="navigation"]')
        .forEach(el => el.remove());
      return body.innerText.trim();
    },
  });

  const text = results?.[0]?.result || '';
  if (text.length > 50) {
    dom.contractText().value = text.substring(0, 10000);
    state.contractText = dom.contractText().value;
    updateCharCount();
    statusEl.textContent = '✓ ページから取得完了';
    statusEl.style.color = 'var(--accent-teal)';
  } else {
    statusEl.textContent = 'テキストが少ないか取得できませんでした。直接貼り付けてください。';
    statusEl.style.color = 'var(--status-warn)';
  }
}

/** PDFモード切替: PDFカードの表示/テキストエリアの非表示 */
function showPdfMode(isPdf) {
  dom.pdfCard().style.display = isPdf ? 'flex' : 'none';
  dom.contractText().style.display = isPdf ? 'none' : 'block';
  dom.textInfo().style.display = isPdf ? 'none' : 'flex';
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// ==========================================
// Position Tabs
// ==========================================
function setupPositionTabs() {
  const tabs = document.querySelectorAll('.position-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      state.selectedPosition = tab.dataset.position;
    });
  });
}

// ==========================================
// Text Input (手動編集も可能)
// ==========================================
function setupTextInput() {
  dom.contractText().addEventListener('input', () => {
    state.contractText = dom.contractText().value;
    state.isPdf = false;
    state.pdfData = null;
    updateCharCount();
    updateAnalyzeButton();
  });
}

function updateCharCount() {
  const len = state.contractText.length;
  dom.charCount().textContent = `${len.toLocaleString()}文字`;
  dom.charCount().style.color = len > 10000 ? 'var(--status-warn)' : '';
}

// ==========================================
// Buttons
// ==========================================
function setupButtons() {
  dom.analyzeBtn().addEventListener('click', startAnalysis);

  document.getElementById('settingsBtn').addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  document.getElementById('goToSettingsBtn').addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  document.getElementById('backBtn').addEventListener('click', async () => {
    showSection('input');
    dom.categoriesContainer().innerHTML = '';
    dom.dangerList().innerHTML = '';
    dom.dangerSection().style.display = 'none';
    await fetchPageContent();
  });
}

// ==========================================
// Section Visibility
// ==========================================
function showSection(name) {
  dom.inputSection().style.display = name === 'input' ? 'flex' : 'none';
  dom.loadingSection().style.display = name === 'loading' ? 'flex' : 'none';
  dom.resultsSection().style.display = name === 'results' ? 'flex' : 'none';
}

// ==========================================
// Analysis
// ==========================================
async function startAnalysis() {
  if (state.isAnalyzing) return;
  if (!state.apiKey) return;

  if (!state.isPdf && state.contractText.trim().length < 50) return;
  if (state.isPdf && !state.pdfData) return;

  state.isAnalyzing = true;
  showSection('loading');

  try {
    const result = await analyzeContract(state.selectedPosition, state.apiKey);
    renderResults(result);
    showSection('results');
  } catch (err) {
    showSection('input');
    showError(err.message);
  } finally {
    state.isAnalyzing = false;
  }
}

// ==========================================
// Gemini API Call
// ==========================================
async function analyzeContract(position, apiKey) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`;

  const parts = state.isPdf
    ? buildPdfParts(position)
    : [{ text: buildPrompt(position, state.contractText) }];

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts }],
      generationConfig: {
        maxOutputTokens: 4096,
        temperature: 0.1,
      },
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    const msg = err?.error?.message || `Gemini API Error: ${response.status}`;
    throw new Error(msg);
  }

  const data = await response.json();
  const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

  return parseAnalysisResult(rawText);
}

/** PDF用: inlineデータ + 指示テキストを parts として返す */
function buildPdfParts(position) {
  return [
    {
      inline_data: {
        mime_type: 'application/pdf',
        data: state.pdfData,
      },
    },
    { text: buildInstructionText(position) },
  ];
}

function buildInstructionText(position) {
  return buildPrompt(position, null);
}

function buildPrompt(position, contractText) {
  const contractSection = contractText
    ? `## 分析対象の契約書\n\n---\n${contractText.substring(0, 10000)}\n---`
    : '## 分析対象の契約書\n\n（上記のPDFファイルを参照してください）';

  return `あなたは日本の契約書レビューの専門家です。以下の契約書を4つの視点から分析し、必ず指定されたJSONフォーマットのみで回答してください。

ユーザーの立場: 【${position}】

## 分析の視点

### 1. 形式的・基本要件（formal）
- 必須項目の有無（日付、当事者名、署名・捺印欄）
- 整合性と正確性（条文番号のズレ、参照条文の正確性）
- 表記ゆれ・誤字脱字（定義用語の一貫性）

### 2. ビジネス・取引条件（business）
- 業務内容・仕様の明確性（何を、いつまでに、どの状態で）
- 検収条件（検収期間・検収基準・みなし承認の有無）
- お金まわりの条件（金額、支払期日、支払方法、振込手数料負担、遅延損害金）
- 知的財産権の帰属（著作権・特許権・業務過程で生まれた成果物の権利）
- 再委託の可否（事前承諾の要否、再委託先への責任範囲）
- 契約期間と自動更新（更新・解約の通知期限）

### 3. 法的リスク・防御（legal）
- 損害賠償の範囲と上限（青天井でないか、逸失利益の有無、上限金額の設定）
- 契約解除の条件（催告なし解除の有無、解除事由の範囲）
- 不可抗力条項（天災・感染症・法改正など免責事由の範囲）
- 違約金・ペナルティ条項（金額・発動条件の妥当性）
- 競業避止・非勧誘条項（期間・地理的範囲・対象の妥当性）
- 秘密保持条項（定義の適切性、存続期間）
- 裁判管轄と準拠法
- 反社会的勢力の排除条項

### 4. 立場別リスク評価（position）
ユーザーが【${position}】であることを踏まえ、その立場にとって不利な条項を評価する

## レスポンスフォーマット

必ず以下のJSONのみを返してください（前後に余計なテキストを含めないこと）:

\`\`\`json
{
  "overallScore": 75,
  "summary": "総合評価の簡潔なコメント（2〜3文）",
  "categories": [
    {
      "id": "formal",
      "name": "形式的・基本要件",
      "items": [
        {
          "name": "必須項目の有無",
          "status": "OK",
          "description": "評価の説明（1〜2文）",
          "detail": "具体的な指摘事項（問題がある場合のみ）"
        }
      ]
    },
    {
      "id": "business",
      "name": "ビジネス・取引条件",
      "items": [...]
    },
    {
      "id": "legal",
      "name": "法的リスク・防御",
      "items": [...]
    },
    {
      "id": "position",
      "name": "立場別リスク（${position}）",
      "items": [...]
    }
  ],
  "dangerWords": [
    {
      "word": "一切の責任を負う",
      "reason": "責任範囲が無制限になる可能性がある表現です",
      "location": "第〇条"
    }
  ]
}
\`\`\`

statusは必ず "OK", "WARNING", "NG" のいずれかを使用してください。
overallScoreは0〜100の整数で、問題が多いほど低くしてください。
dangerWordsは【${position}】の立場から特にリスクが高い表現を抽出してください。

${contractSection}`;
}

function parseAnalysisResult(rawText) {
  const jsonMatch = rawText.match(/```json\s*([\s\S]*?)\s*```/);
  const jsonStr = jsonMatch ? jsonMatch[1] : rawText;

  try {
    return JSON.parse(jsonStr);
  } catch {
    const cleanJson = jsonStr.replace(/^[^{]*/, '').replace(/[^}]*$/, '');
    return JSON.parse(cleanJson);
  }
}

// ==========================================
// Render Results
// ==========================================
function renderResults(data) {
  renderScoreSummary(data);
  renderCategories(data.categories || []);
  renderDangerWords(data.dangerWords || []);
}

function renderScoreSummary(data) {
  const score = data.overallScore || 0;

  dom.overallScore().textContent = getScoreLabel(score);
  dom.summaryText().textContent = data.summary || '';

  setTimeout(() => {
    dom.scoreFill().style.width = `${score}%`;
  }, 100);

  const allItems = (data.categories || []).flatMap(c => c.items || []);
  const okCount = allItems.filter(i => i.status === 'OK').length;
  const warnCount = allItems.filter(i => i.status === 'WARNING').length;
  const ngCount = allItems.filter(i => i.status === 'NG').length;

  const badges = dom.scoreBadges();
  badges.innerHTML = '';
  if (okCount > 0) badges.innerHTML += `<span class="badge badge-ok">✓ 問題なし ${okCount}件</span>`;
  if (warnCount > 0) badges.innerHTML += `<span class="badge badge-warn">△ 要確認 ${warnCount}件</span>`;
  if (ngCount > 0) badges.innerHTML += `<span class="badge badge-ng">✗ 問題あり ${ngCount}件</span>`;
}

function getScoreLabel(score) {
  if (score >= 85) return '優良';
  if (score >= 70) return '良好';
  if (score >= 55) return '要確認';
  if (score >= 40) return '要修正';
  return '要注意';
}

function renderCategories(categories) {
  const container = dom.categoriesContainer();
  container.innerHTML = '';

  const categoryNumbers = ['01', '02', '03', '04'];

  categories.forEach((category, index) => {
    const items = category.items || [];

    const card = document.createElement('div');
    card.className = `category-card ${index === 0 ? 'expanded' : ''}`;

    const dotsHtml = items.slice(0, 6).map(item => {
      const cls = item.status === 'OK' ? 'dot-ok' : item.status === 'WARNING' ? 'dot-warn' : 'dot-ng';
      return `<span class="status-dot ${cls}"></span>`;
    }).join('');

    const itemsHtml = items.map(item => {
      const cls = item.status === 'OK' ? 'ok' : item.status === 'WARNING' ? 'warning' : 'ng';
      const icon = item.status === 'OK' ? '✓' : item.status === 'WARNING' ? '△' : '✗';
      const detailHtml = item.detail
        ? `<div class="check-detail">${escapeHtml(item.detail)}</div>`
        : '';
      return `
        <div class="check-item ${cls}">
          <div class="check-item-header">
            <span class="check-status-icon">${icon}</span>
            <span class="check-name">${escapeHtml(item.name)}</span>
          </div>
          <div class="check-description">${escapeHtml(item.description || '')}</div>
          ${detailHtml}
        </div>
      `;
    }).join('');

    card.innerHTML = `
      <div class="category-header">
        <div class="category-title-area">
          <span class="category-number">${categoryNumbers[index] || '0' + (index + 1)}</span>
          <span class="category-name">${escapeHtml(category.name)}</span>
        </div>
        <div class="category-meta">
          <div class="category-status-dots">${dotsHtml}</div>
          <span class="category-chevron">▼</span>
        </div>
      </div>
      <div class="category-items">${itemsHtml}</div>
    `;

    card.querySelector('.category-header').addEventListener('click', () => {
      card.classList.toggle('expanded');
    });

    container.appendChild(card);
  });
}

function renderDangerWords(dangerWords) {
  if (!dangerWords || dangerWords.length === 0) {
    dom.dangerSection().style.display = 'none';
    return;
  }

  dom.dangerSection().style.display = 'block';
  dom.dangerCount().textContent = `${dangerWords.length}件`;

  const list = dom.dangerList();
  list.innerHTML = dangerWords.map(dw => `
    <div class="danger-item">
      <span class="danger-word">${escapeHtml(dw.word)}</span>
      <div class="danger-reason">${escapeHtml(dw.reason || '')}</div>
      ${dw.location ? `<div class="danger-location">📍 ${escapeHtml(dw.location)}</div>` : ''}
    </div>
  `).join('');
}

function showError(message) {
  const main = document.getElementById('mainContent');
  const existing = main.querySelector('.error-card');
  if (existing) existing.remove();

  const card = document.createElement('div');
  card.className = 'error-card';
  card.innerHTML = `<strong>エラーが発生しました</strong>${escapeHtml(message)}`;
  dom.inputSection().prepend(card);
}

// ==========================================
// Utility
// ==========================================
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
