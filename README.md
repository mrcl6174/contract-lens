# ⚖ ContractLens

**AIによる契約書レビュー Chrome拡張機能**

Google Gemini APIを使用して、契約書を4つの専門的な視点から自動レビューします。

![License](https://img.shields.io/badge/license-Non--Commercial-red)
![Manifest](https://img.shields.io/badge/Manifest-V3-blue)
![API](https://img.shields.io/badge/API-Gemini%20Flash-orange)

---

## 機能

- **サイドパネル表示** — Chromeのサイドパネルで表示。ページを見ながら分析結果を確認できます
- **自動テキスト取得** — 拡張機能を開くと開いているページのテキストを自動取得
- **PDF対応** — PDFファイルをGeminiへ直接送信して解析
- **4視点レビュー** — 形式・ビジネス・法的リスク・立場別の観点から総合評価
- **危険ワード検出** — リスクの高い表現を抽出して一覧表示

## レビューの視点

| # | カテゴリ | チェック内容 |
|---|---------|------------|
| 01 | 形式的・基本要件 | 必須項目の有無、整合性、表記ゆれ |
| 02 | ビジネス・取引条件 | 業務内容、検収条件、報酬、知財、再委託、契約期間 |
| 03 | 法的リスク・防御 | 損害賠償上限、解除条件、不可抗力、違約金、競業避止、NDA |
| 04 | 立場別リスク評価 | 選択した立場（委託側/受託側/買主/売主）から見たリスク |

## インストール

### 必要なもの

- Google Chrome (Chromiumブラウザも含む)
- [Google AI Studio](https://aistudio.google.com/apikey) で取得した Gemini API キー（無料）

### 手順

1. このリポジトリをクローンまたはZIPでダウンロード
   ```bash
   git clone https://github.com/mrcl6174/contract-lens.git
   ```

2. Chrome で `chrome://extensions` を開く

3. 右上の「デベロッパーモード」をオンにする

4. 「パッケージ化されていない拡張機能を読み込む」をクリックし、ダウンロードしたフォルダを選択

5. 拡張機能アイコンを右クリック → 「オプション」から Gemini API キーを設定

## 使い方

1. 契約書が表示されているページ（HTMLまたはPDF）を開く
2. 拡張機能のアイコンをクリックしてサイドパネルを開く
3. あなたの立場（委託側 / 受託側 / 買主 / 売主）を選択
4. 「レビュー開始」をクリック
5. 数秒で4つの視点からの分析結果が表示されます

## 技術スタック

- Chrome Extension Manifest V3
- Google Gemini API (`gemini-flash-latest`)
- Vanilla JavaScript / CSS

## ライセンス

このソフトウェアは **非商用ライセンス** の下で公開されています。個人利用・学習目的での使用は自由ですが、**商用利用は禁止**です。詳細は [LICENSE](./LICENSE) を参照してください。

## 注意事項

- API キーはブラウザのローカルストレージにのみ保存されます
- 契約書の内容はGemini APIに送信されます。機密性の高い文書には注意してください
- 本ツールの分析結果は参考情報です。最終的な契約判断は専門家にご相談ください
