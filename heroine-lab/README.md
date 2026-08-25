# ヒロイン生成ラボ

プレイヤーが設定した容姿・声質・性格を、画像／音声／台詞の生成入力へ変換する
プロトタイプ。設計の背景と法務チェックリストは
[`docs/heroine-generation.md`](../docs/heroine-generation.md) を参照。

## 動かす

ESモジュールを使うのでファイル直開き（`file://`）ではなく HTTP で配信する。

```sh
python3 -m http.server 8000
# → http://127.0.0.1:8000/heroine-lab/
```

既定のアダプタは **モック**なので、バックエンドが無くても
UI・プロンプト生成・キャラカードの動作を確認できる。

## 実エンジンに繋ぐ

「生成エンジンの接続設定」を開いてエンドポイントを指定する。

| 種別 | 対応 | 既定ポート |
|---|---|---|
| 画像 | ComfyUI / AUTOMATIC1111・Forge | 8188 / 7860 |
| 音声 | Style-Bert-VITS2 / VOICEVOX | 5000 / 50021 |
| 台詞 | OpenAI互換API（Ollama / llama.cpp / LM Studio） | 11434 |

ブラウザから別ポートへ叩くので、各サーバ側で CORS 許可が要る
（A1111 なら `--cors-allow-origins`、ComfyUI なら `--enable-cors-header`）。

## ファイル構成

| ファイル | 役割 |
|---|---|
| `schema.js` | 設定項目の定義。**UI・プロンプト・カードの唯一の出典** |
| `safety.js` | 成人限定・禁止語・実在人物の遮断。生成の必須通過点 |
| `compile.js` | 設定 → 画像prompt / 音声params / ペルソナ / seed |
| `adapters/` | 生成エンジンごとの差し替え可能な実装 |
| `app.js` | 配線とUI |

設定項目を増やすときは `schema.js` に1項目足すだけでよい。
UI もプロンプトもキャラカードも自動で追従する。

## ローカル定義ファイル（任意・gitignore対象）

| ファイル | 用途 |
|---|---|
| `ratings.local.json` | 表現レベル別の追加タグ。本リポジトリには同梱しない |
| `blocklist.local.json` | 禁止語彙の追加（配布先の規約語彙・実在人物名） |

それぞれ `.example` を用意してある。無くても動作する。
