# daizu-tts

Voicevoxを利用した小規模向けのシンプルなDiscord読み上げボット

> このプロジェクトは日本語のみ対応します。他の言語（英語を含め）はサポート範囲外です。
>
> This project is intended only for Japanese TTS. Other languages, including English, are **NOT** supported.

voicevox-tts-discord のフォークです

This is a fork of voice-tts-discord

元のプロジェクトと比べてkagome front、remote replaceとGoを使用せず、シンプル化を行われました。

## 機能

1. 指定したチャンネルのテキストを読み上げる
2. ボイチャが始まったときの通知と自動入室
3. 入室、退室通知（読み上げのみ）
4. ユーザー辞書、グローバル辞書

## WIP

SQLiteの導入

Refactor

## Licenses

元のプロジェクトから引き継いたコードはすべてBSD-3-Clause Licenseです。

RuriSapphireによって書かれたコードはすべてMIT Licenseです。

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

1. Discordのトークンを取得する
    1. [Discord Developer Portal](https://discord.com/developers/applications )
    2. `New Application`からアプリケーションを作る
    3. `APPLICATION ID`をコピーする
    4. `https://discord.com/oauth2/authorize?client_id=APPLICATIONID&scope=bot&permissions=3148800`の`APPLICATIONID`をコピーしたやつに置き換えてメモっとく(招待用のURL)

    > Permissions について
    >
    > この bot は、以下の Permissions を使用します
    >
    > OAuth2: bot
    >
    > Bot Permissions: Read Messages / View Channels, Send Messages, Connect, Speak

    5. `Bot`→`Add Bot`
    6. `Build-A-Bot`の`Reset Token`を押してトークンを生成してメモっておく
    7. その下の`MESSAGE CONTENT INTENT`を有効にする
    > 読み上げのため、`MESSAGE CONTENT INTENT`は必須です
2. Voicevox Engineを入れる
    1. [Voicevoxの公式](https://voicevox.hiroshiba.jp/ )から自分の環境に合ったやつをダウンロードしてくる(Engineのリポジトリが最新じゃないのでフル版のEngine部分だけ使う)
    2. `run`を実行する(違う名前になる場合があります)`--port`でポート指定してください(わからない場合は `--port 2970` )。同じコンソールでVoicevoxとdaizu-ttsを動かしたいときには、最後に&をつけます。
3. 環境を整える
    1. 好きな方法でNode.jsとpnpmを入れる(Node.js v20以上が必要です) 
    2. 好きな方法でGitを入れる
    3. 好きな方法でFFmpegを入れる(Linuxならパッケージマネージャーから入れるといい)
4. 起動する
    1. `git clone https://github.com/TamakiRuri/daizu-tts.git; cd daizu-tts`
    2. `cp sample.json config.json`
    3. config.jsonを編集する
        - `VOICEVOX_ENGINE`は2970を自分の指定したポートに合わせる
        - `TMP_DIR`は音声のキャッシュディレクトリ、頻繁に書き換わるのでシステムのメモリ上で保存するキャッシュメモリが好ましい
        - `TOKEN`は上でメモったBotトークン
        - `PREFIX`は読み上げない文章につけるプリフィックス
        - `SERVER_DIR`はサーバーごとの設定ファイルが保存されるディレクトリ、そのまま使うなら`servers`ってフォルダを作ること
        - `OPUS_CONVERT`はOpus(オープンソースな音声フォーマット)(BSD-3License)への変換機能の設定です。`bitrate`はビットレート、`threads`はスレッド数です。
        - `DICT_DIR`はグローバル辞書を保存するディレクトリ、そのまま編集することで使えます。
    4. `npm install`
    5. `npm run production`
    6. 招待用のURLでサーバーへ招待します。
    7. SystemdのServiceのサンプルは/servicesに保存されています。

## 使い方

```
    /start //初めて利用する場合のチュートリアル
    /auto //自動接続・ボイスチャット検知有効/無効
    /setchannel //ボイスチャット検知の通知チャンネルを設定する
    /connect  //ボイスチャットに接続
    /disconnect  //ボイスチャットから切断
    /setvoice  //話者を変更(選択肢の上限が25のため、4つに分けられています)
    /help  //ヘルプ

```

## Update Log

#### 0.2.1

**仕様変更あり**

- server fileの`channelpair`キーワードを`textchannel`に変更しました。
- 読み上げのチャンネルを設定するコマンド`/setchannelpair`を`/settextchannel`に変更しました。
- pnpmをデフォルトのnpmに変更しました。
- pnpm から更新される場合、node-modules, pnpm-lockを削除し、npm installで導入します。
- 初めて利用する方のための`/start`コマンドを追加しました。

#### 0.2.0

- ボイチャ検知と自動入室を追加しました。
- 自動入室した場合、デフォルトではそのテキストチャンネルのみを読み上げます。
- ` /setchannelpair`でサーバーのデフォルト読み上げチャンネルを変更します。
- 今後、`/setchannelpair`をサーバー全体ではなく、一つのボイスチャンネルとその対応するテキストチャンネルを設定できるようにします。

> もし問題がありましたら、issueで書いてくれると助かります。

<!--
## dictionaries以下のファイルについて
Kagome frontで利用されている形態素解析辞書、Neologd辞書はネット辞書であるというその性質上、間違った読み、自動化のミスによる異常な読み、極端に特定の界隈に偏った略語、一般的ではあるが問題のある略語などを含みます。

このボットでは対策として置換時に辞書上の表現と完全一致でマッチさせ、英字の場合は更に3文字以上の場合のみマッチにする対策を取っていますが、それでもおかしい読みがある場合の対策にKagomeの分かち書き単位で置換する辞書を用意しています。

`dictionaries/fix_neologd.json`はボット運用時に判明した怪しい読みを比較的普通の読みに置換する目的でリポジトリに含まれています。

`dictionaries/lite_neologd.json`は面白くないやつだけ直す目的で利用できます。

このファイルは[CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/deed.ja ) または [NYSL 0.9982](https://www.kmonos.net/nysl/ )で利用できます。
-->