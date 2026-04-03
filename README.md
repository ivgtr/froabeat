# FroaBeat

**Beat Visualizer & GIF Collage on an Infinite Canvas**

音声の拍とビジュアルを同じ空間で扱うブラウザアプリです。
音楽のテンポ可視化と GIF コラージュを組み合わせ、遊べる視覚演出空間を提供します。

**[Demo](https://ivgtr.github.io/froabeat/)**

## Features

- **Audio** - ファイル読み込み (D&D / 選択)、再生・一時停止・ループ、段階的速度変更 (0.5x - 2.0x)
- **BPM** - 音声波形ベースのテンポ推定と中央ビート演出
- **GIF Collage** - GIF の複数配置、移動・拡大縮小・削除
- **GIF Sync** - ビートに追従するフレーム制御 (Pulse / Tempo モード)
- **Infinite Canvas** - パン移動による無限キャンバス

すべてクライアントサイドで完結し、ユーザーファイルを外部送信しません。

## Keyboard Shortcuts

| Key | Action |
| --- | --- |
| `Enter` | 選択中の GIF のバウンスをトグル / 未選択時は全体をトグル |
| `Delete` / `Backspace` | 選択中の GIF を削除 |
| `+` / `-` | キャンバスのズームイン / ズームアウト |

## Tech Stack

React / TypeScript / Vite / Zustand / Web Audio API / Canvas / GitHub Pages

## Getting Started

```bash
# pnpm 専用です
pnpm install
pnpm dev
```

### Commands

| Command | Description |
| --- | --- |
| `pnpm dev` | 開発サーバーを起動 |
| `pnpm build` | プロダクションビルド |
| `pnpm preview` | ビルド成果物をプレビュー |
| `pnpm lint` | ESLint を実行 |

## Known Limitations

- シーク、保存/共有、動画書き出しは対象外
- BPM 推定は音源依存; 推定不可時はフォールバック BPM (120) を使用
- GIF フレーム同期は `ImageDecoder` 対応ブラウザで有効

## License

[MIT](./LICENSE)
