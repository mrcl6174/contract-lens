'use strict';

// アイコンクリック時にサイドパネルを開く
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch(console.error);

// ==========================================
// PDF フェッチ (CORS バイパス)
// ==========================================
// background service worker は host_permissions (<all_urls>) により
// CORS 制限なしで任意の URL を fetch できる。
// PDF ビューアのページコンテキスト (chrome-extension://) から直接 fetch すると
// クロスオリジンになって失敗するため、ここで代わりに取得する。
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'fetchPdf') {
    fetchPdf(request.url)
      .then(result => sendResponse(result))
      .catch(err => sendResponse({ error: err.message }));
    return true; // 非同期レスポンスのため true を返す
  }
});

async function fetchPdf(url) {
  const MAX_SIZE = 20 * 1024 * 1024; // 20MB

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText}`);
  }

  const buffer = await response.arrayBuffer();
  if (buffer.byteLength > MAX_SIZE) {
    throw new Error(
      `PDFが大きすぎます（${Math.round(buffer.byteLength / 1024 / 1024)}MB、上限20MB）`
    );
  }

  // ArrayBuffer → base64 (チャンク処理でスタックオーバーフロー回避)
  const bytes = new Uint8Array(buffer);
  const CHUNK = 8192;
  const chunks = [];
  for (let i = 0; i < bytes.length; i += CHUNK) {
    chunks.push(String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK)));
  }

  return { base64: btoa(chunks.join('')), size: buffer.byteLength };
}
