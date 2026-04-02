# FroaBeat

FroaBeat は、音声の拍とビジュアルを同じ空間で扱うためのブラウザアプリです。  
音楽のテンポ可視化と GIF コラージュを組み合わせ、遊べる視覚演出空間を提供します。

## コンセプト
- 音のリズムを、画面中央のビート演出として直感的に見せる
- 無限キャンバス上に GIF を自由配置して、楽曲と視覚を重ねる
- すべてクライアントサイドで完結し、ユーザーファイルを外部送信しない

## 想定する主要機能
- 音声ファイルの読み込み（Drag & Drop / ファイル選択）
- 再生 / 一時停止 / ループ / 段階的な再生速度変更
- 音声波形ベースの BPM 推定と中央ビート演出
- GIF の読み込み、複数配置、移動・拡大縮小・削除
- 無限キャンバスのパン移動

## 技術スタック
- React + TypeScript
- Vite
- Zustand
- Web Audio API
- HTML Canvas（無限キャンバス構成）
- GitHub Pages（静的配信）

## 開発環境
- Node.js 22 以上推奨
- pnpm 10.33.0（Corepack 推奨）

## パッケージマネージャー方針
- このプロジェクトは `pnpm` 専用です。
- `npm` / `yarn` / `bun` でのインストールは `preinstall` で失敗します。

## セットアップ
```bash
pnpm install
```

## 開発コマンド
```bash
pnpm dev
pnpm lint
pnpm build
pnpm preview
```

## GitHub Pages デプロイ
- `main` ブランチへの push で `.github/workflows/deploy.yml` が実行されます。
- Vite の `base` は本リポジトリ向けに `/froabeat/` を設定済みです。
- 公開先 URL 例: `https://<GitHubユーザー名>.github.io/froabeat/`

## リポジトリ構成（主要）
- `src/components/`: UI レイヤーと画面構造
- `src/features/`: 機能単位のロジック
- `src/stores/`: Zustand ストア
- `src/lib/`: 汎用ユーティリティ
- `src/types/`: 型定義
