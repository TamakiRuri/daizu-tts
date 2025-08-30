# daizu-tts

Voicevoxを利用した小規模向けのシンプルなDiscord読み上げボット

> このプロジェクトは日本語のみ対応します。他の言語（英語を含め）はサポート範囲外です。
>
> This project is intended only for Japanese TTS. Other languages, including English, are **NOT** supported.

[voicevox-tts-discord](https://github.com/notoiro/voicevox-tts-discord) のフォークです (現kana)

This is a fork of voice-tts-discord (an older version of kana)

元のプロジェクトと比べてkagome front、remote replaceとGoを使用せず、セットアップがよりシンプルになっています。

> このプロジェクトはLinuxを想定しています。WindowsではWSLのみ動作確認をしています。

## 機能

1. 指定のチャンネルの読み上げ
2. ボイチャが始まったときの通知と自動入室
    - 0.2.2からスパム防止のため、1分以内のセッションでは通知を行わなくなり、その後の1分間に始まったセッションの入室通知も行わなくなります。
3. 入室、退室の時IDの読み上げ
4. ユーザー辞書、グローバル辞書

## WIP

Refactor

## Licenses

元のプロジェクトから引き継いたコードはすべてBSD-3-Clause Licenseです。

（説明がない限りでは、すべてBSD-3-Clause License (c) Notoiroです）

RuriSapphireによって書かれたコードはすべてMIT License (c) RuriSapphireです。

（MITライセンスの場合、ファイル先頭部分に説明があります）

## 必要なもの

1. Git
2. Node.js  v20以上 (aptでインストールするとv18がインストールされることがありますのでご注意ください)
3. [Voicevox Engine](https://github.com/VOICEVOX/voicevox_engine/)
4. Discord APIのトークン
5. FFmpeg

<!--

1. メモリ上に乗ったキャッシュ用ディレクトリがあると良い
    - Linuxなら/tmpで良い気がする

-->

## 動かし方

1. Discordのトークンを取得します
    1. [Discord Developer Portal](https://discord.com/developers/applications )
    2. `New Application`からアプリケーションを作ります
    3. `APPLICATION ID`をコピーします
    4. `https://discord.com/oauth2/authorize?client_id=APPLICATIONID&scope=bot&permissions=3148800`の`APPLICATIONID`をコピーしたIDに置き換え、招待用のURLになります

    > Permissions について
    >
    > この bot は、以下の Permissions を使用します
    >
    > OAuth2: bot
    >
    > Bot Permissions: Read Messages / View Channels, Send Messages, Connect, Speak

    5. `Bot`→`Add Bot`
    6. `Build-A-Bot`の`Reset Token`を押してトークンを生成します
    7. その下の`MESSAGE CONTENT INTENT`を有効にします
    > 読み上げのため、`MESSAGE CONTENT INTENT`は必須です
2. Voicevox Engineを入れます
    1. [Voicevoxの公式](https://voicevox.hiroshiba.jp/ )から自分の環境に合ったやつをダウンロードしてくる(Engineのリポジトリが最新じゃないのでフル版のEngine部分だけ使う)
    2. vv-engineフォルダの中の`run`を実行する(違う名前になる場合があります)`--port`でポート指定してください(わからない場合は `--port 2970` )。同じコンソールでVoicevoxとdaizu-ttsを動かしたいときには、最後に&をつけます。
    例: VOICEVOXフォルダで `./vv-engine/run --port 2970 &`
3. 環境を整えます
    1. 好きな方法でNode.jsを入れます(Node.js v20以上が必要です) 
    2. 好きな方法でGitを入れます
    3. 好きな方法でFFmpegを入れます(Linuxならパッケージマネージャーから入れるといい)
4. 起動します
    1. `git clone https://github.com/TamakiRuri/daizu-tts.git; cd daizu-tts`
    2. `cp sample.json config.json`
    3. config.jsonを編集します
        - `VOICEVOX_ENGINE`: 2970を自分の指定したポートに合わせます
        - `TMP_DIR`: 音声のキャッシュディレクトリ。頻繁に書き換わるのでシステムのメモリ上で保存するキャッシュメモリが好ましいです
        - `TOKEN`: 上のBotトークンです。忘れたらもう一回Reset Tokenで再生成できます
        - `PREFIX`: 読み上げない文章につけるプリフィックス
        - `SERVER_DIR`: サーバーの設定ファイルが保存されるディレクトリ。そのまま使うなら`servers`ってフォルダを作っておいたほうがいいでしょう
        - `OPUS_CONVERT`: Opus(オープンソースな音声フォーマット)(BSD-3License)への変換機能の設定
        - `bitrate`: Opusのビットレート
        - `threads`: Opusのスレッド数
        - `DICT_DIR`: グローバル辞書を保存するディレクトリ。その中の辞書を編集することでグローバル辞書を追加できます
        - `TEXT_LENGTH_NORMAL`: 通常のスピードで読み上げる一つの文章の文字数上限
        - `TEXT_LENGTH_MAX`: スピードアップ含めた読み上げる一つの文章の文字数上限
        - `PRONOUNCE_SPEED_MAX`: 通常の上限を超えた状態で読み上げのスピード。デフォルト: 0, 上限: 200
    4. `npm install`
    5. `npm run production`
    6. 招待用のURLでサーバーへ招待します。
    7. SystemdのServiceのサンプルは/servicesに保存されています。

## 使い方

```
    /start //初めて利用する時のチュートリアル
    /auto //自動接続・ボイスチャット検知有効/無効
    /setnotifychannel //ボイスチャット検知の通知チャンネルを現在のチャンネルに設定
    /resetnotifychannel //通知を無効にする
    /connect  //ボイスチャットに接続
    /disconnect  //ボイスチャットから切断
    /setvoice  //話者を変更(選択肢の上限が25のため、4つに分けられています)
    /help  //ヘルプ

```

> もし問題がありましたら、issueで書いてくれると助かります。
