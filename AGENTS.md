# AGENTS.md

このファイルは、このリポジトリで作業するエージェント向けの実務ルールです。

## 1. コミュニケーション
- 日本語で、簡潔かつ丁寧に回答する。

## 2. パッケージマネージャー
- `pnpm` を使用すること。
- `npm` / `yarn` / `bun` は使用しないこと。
- 主要コマンド:
  - `pnpm install`
  - `pnpm dev`
  - `pnpm lint`
  - `pnpm build`
  - `pnpm preview`

## 3. Git運用
- `.docs/` はコミット対象外（`.gitignore` 設定済み）。
- 仕様検討メモや計画書は `.docs/` 配下で管理し、実装成果物は通常のソース配下に反映する。
- 既存変更を勝手に巻き戻さないこと。

## 4. 実装方針（現時点）
- 技術スタック: React + TypeScript + Vite。
- 状態管理: Zustand（`audioStore` と `boardStore` を分離）。
- GitHub Pages 前提のため、静的配信で完結する実装を優先する。

## 5. 変更前後の確認
- 変更後は最低限 `pnpm lint` と `pnpm build` を実行する。
- UI 変更時は、レイアウト崩れがないかを `pnpm dev` で確認する。
