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

## 検証フロー（Phase 5）
1. `pnpm dev` を起動する
2. 音声を読み込み、`再生` 押下後に右下時刻が進行することを確認する
3. 速度変更（`0.5x`〜`2.0x`）とループON/OFFで再生継続することを確認する
4. GIF を選択し、`GIF Sync` で `Mode A: Pulse` または `Mode B: Tempo` を選ぶ
5. 再生中に GIF が拍に追従して反応し、`OFF` へ戻すと通常再生へ戻ることを確認する
6. GIF を複数投入して移動/拡大縮小/削除を実行し、操作継続可能なことを確認する
7. `pnpm lint` / `pnpm build` を実行する

## 既知制約
- シーク、保存/共有、書き出し、モバイル最適化は MVP 対象外です。
- BPM 推定は音源依存で誤差が発生するため、推定不可時はフォールバック BPM（120）を使用します。
- GIF のフレーム同期は `ImageDecoder` 対応ブラウザで有効です。非対応・高負荷時は自動で通常 GIF 再生へフォールバックします。
- `Mode B: Tempo` はフレーム制御可能な GIF でのみ有効です。フォールバック時は UI に理由が表示されます。
- 表示中のフレーム制御 GIF が多い場合は `LOW-POWER` 表示となり、更新頻度を自動で抑制します。

## トラブルシュート
- `再生中` 表示でも時刻が進まない場合:
  1. ブラウザをハードリロードする（`Cmd+Shift+R` / `Ctrl+Shift+R`）
  2. `再生` を再押下して `READY` ステータスへ戻るか確認する
  3. コンソールに `AudioContext` 関連エラーが出ていれば、ログ付きで再現手順を記録する
- 非対応形式のファイルを投入した場合は、左上のエラー表示を確認し対応形式へ差し替えてください。

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
