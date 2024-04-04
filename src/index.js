"use strict";
// deps
const {
  joinVoiceChannel, getVoiceConnection, createAudioResource,
  StreamType, createAudioPlayer, NoSubscriberBehavior,
  VoiceConnectionStatus, entersState, AudioPlayerStatus
} = require("@discordjs/voice");
const {
  Client, GatewayIntentBits, ApplicationCommandOptionType,
  EmbedBuilder, ActivityType, Collection
} = require('discord.js');
const fs = require('fs');
const os = require('os');
const { isRomaji, toKana } = require('wanakana');
const log4js = require('log4js');

const Voicevox = require('./voicevox.js');
//const RemoteReplace = require('./remote_replace.js');
const ResurrectionSpell = require('./resurrection_spell.js');
const Utils = require('./utils.js');
const BotUtils = require('./bot_utils.js');
const convert_audio = require('./convert_audio.js');
const print_info = require('./print_info.js');

const sleep = waitTime => new Promise( resolve => setTimeout(resolve, waitTime) );
const xor = (a, b) => ((a || b) && !(a && b));
const escape_regexp = (str) => str.replace(/[.*+\-?^${}()|[\]\\]/g, '\\$&');
const ans = (flag, true_text, false_text) => {
  return flag ? true_text:false_text;
};

const priority_list = [ "最弱", "よわい", "普通", "つよい", "最強" ];


//初期化など

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent
  ]
});

client.commands = new Collection();

const voicevox = new Voicevox();

let logger = log4js.getLogger();
const bot_utils = new BotUtils(logger);

let connections_map = new Map();

let voice_library_list = [];


// Discordで選択肢作ると25個が限界
const MAXCHOICE = 25;
const SKIP_PREFIX = "s";

const {
  TOKEN, PREFIX, TMP_DIR, OPUS_CONVERT, DICT_DIR, TMP_PREFIX
} = require('../config.json');

module.exports = class App{
  constructor(){
//    this.remote_repalce = new RemoteReplace();
    this.voicevox = voicevox;
    this.voice_list = [];
    this.dictionaries = [];
    this.dict_regexp = null;
    this.commands = {};
    this.config = {
      opus_convert: { enable: false, bitrate: '96k', threads: 2 }
    };

    this.status = {
      debug: !(process.env.NODE_ENV === "production"),
      connected_servers: 0,
      discord_username: "NAME",
      opus_convert_available: false,
      remote_replace_available: false,
      extend_enabled: bot_utils.EXTEND_ENABLE
    };


    logger.level = this.status.debug ? 'debug' : 'info';

  }

  async start(){
    this.setup_config();
    await this.setup_voicevox();
    await this.test_opus_convert();
    this.setup_dictionaries();
    //await this.test_remote_replace();
    this.setup_discord();
    this.setup_process();

    client.login(TOKEN);
  }

  setup_config(){
    if(OPUS_CONVERT !== undefined && OPUS_CONVERT.hasOwnProperty('enable')){
      this.config.opus_convert.enable = OPUS_CONVERT.enable;
      if(OPUS_CONVERT.enable){
        this.config.opus_convert.bitrate = OPUS_CONVERT.bitrate ?? this.config.opus_convert.bitrate;
        this.config.opus_convert.threads = OPUS_CONVERT.threads ?? this.config.opus_convert.threads;
      }
    }

    this.config.opus_convert.threads = this.config.opus_convert.threads.toString();
  }

  async setup_voicevox(){
    await voicevox.check_version();
    const voiceinfos = await this.get_voicelist();
    this.voice_list = voiceinfos.speaker_list;
    voice_library_list = voiceinfos.voice_library_list;

    logger.debug(this.voice_list);
    logger.debug(voice_library_list);

    bot_utils.init_voicelist(this.voice_list, voice_library_list);

    const tmp_voice = { speed: 1, pitch: 0, intonation: 1, volume: 1 };

    try{
      await voicevox.synthesis("てすと", `test${TMP_PREFIX}.wav`, 0, tmp_voice);
    }catch(e){
      logger.info(e);
    }
  }

  async test_opus_convert(){
    try{
      const opus_voice_path = await convert_audio(`${TMP_DIR}/test${TMP_PREFIX}.wav`, `${TMP_DIR}/test${TMP_PREFIX}.ogg`);
      this.status.opus_convert_available = !!opus_voice_path;
    }catch(e){
      logger.info(`Opus convert init err.`);
      console.log(e);
      this.status.opus_convert_available = false;
    }
  }

  // 利用可能かテストする
  /*
  async test_remote_replace(){
    if(!this.remote_repalce.enabled){
      this.status.remote_replace_available = false;
      return;
    }
    try{
      await this.remote_repalce.replace_http('A person who destroys a submarine telegraph line in order to protect his own life or ship, or in order to lay or repair a submarine telegraph line, shall notify the telegraph office or the Imperial Consulate immediately by wireless telegraphy, and if wireless telegraphy is not possible, shall notify the local telegraph office or the Imperial Consulate within 24 hours of the first landing of the ship. Any person who violates the provisions of the preceding paragraph shall be fined not more than 200 yen.');
      this.status.remote_replace_available = true;
    }catch(e){
      logger.info(e);
      this.status.remote_replace_available = false;
    }
  }
  */


  setup_discord(){
    // コマンド取得
    const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));
    for (const file of commandFiles) {
      const command = require(`../commands/${file}`);
      this.commands[command.data.name] = command;
    }

    const setvoice_commands = [];

    for(let i = 0; i < Math.ceil(this.voice_list.length/MAXCHOICE); i++){
      const start = i * MAXCHOICE;
      const end = (i + 1) * MAXCHOICE;

      const setvoice_command = {
        name: `setvoice${i + 1}`,
        description: `声を設定します。(${i + 1}ページ目)`,
        options: [
          {
            type: ApplicationCommandOptionType.Integer,
            name: "voice",
            description: "どの声がいいの？",
            required: true,
            choices: this.voice_list.slice(start, end)
          }
        ]
      };

      setvoice_commands.push(setvoice_command);
    }

    client.on('ready', async () => {
      // コマンド登録
      let data = [];
      for(const commandName in this.commands) data.push(this.commands[commandName].data);

      data = data.concat(setvoice_commands);
      logger.debug(data);

      await client.application.commands.set(data);

      this.status.connected_servers = client.guilds.cache.size;
      this.status.discord_username = client.user.displayName;

      print_info(this);

      this.update_status_text();
    });

    client.on('interactionCreate', this.onInteraction.bind(this));

    client.on('messageCreate', (msg) => {
      if(!(msg.guild) || msg.author.bot) return;

      if(msg.content === SKIP_PREFIX){
        this.skip_current_text(msg.guild.id);
        return;
      }

      if(this.is_target(msg)){
        this.add_text_queue(msg);
      }
    });

    client.on('voiceStateUpdate', this.check_join_and_leave.bind(this));
  }

  setup_process(){
    process.on('uncaughtExceptionMonitor', (_) => {
      if(process.env.NODE_ENV === "production") client.destroy();
    });
    process.on("exit", _ => {
      logger.info("Exit!");
      if(process.env.NODE_ENV === "production") client.destroy();
    });
  }

  setup_dictionaries(){
    let json_tmp;

    let map_tmp = [] //new Map();

    // ないなら無視する
    if(!fs.existsSync(`${DICT_DIR}`)){
      logger.info("Global dictionary file does not exist!");
      return;
    }
    for(const dir of fs.readdirSync(`${DICT_DIR}`)){
      try {
        if(fs.existsSync(`${DICT_DIR}/${dir}`)){
          json_tmp = JSON.parse(fs.readFileSync(`${DICT_DIR}/${dir}`))
          json_tmp.dict.forEach( (dict) => {
            if(!map_tmp.some((dic) => dic[0] === dict[0] )){
              map_tmp.push(dict);
            }
          });
        }
      } catch (e) {
        logger.info(e);
      }
    }

    this.dictionaries = map_tmp;

    if(this.dictionaries.length){
      this.dict_regexp = new RegExp(`^${this.dictionaries.map(d => escape_regexp(d[0])).join("|")}$`, 'g');
    }
  }

  async onInteraction(interaction){
    if(!(interaction.isChatInputCommand()) || !(interaction.inGuild())) return;

    logger.debug(interaction);

    // コマンド実行
    const command = this.commands[interaction.commandName];

    try {
      let command_name = interaction.commandName;

      switch(command_name){
        case "connect":
        case "setvoiceall":
        case "currentvoice":
        case "resetconnection":
        case "dicadd":
        case "dicedit":
        case "dicdel":
        case "dicpriority":
        case "systemvoicemute":
        case "copyvoicesay":
        case "info":
          if(command_name === "connect") command_name = "connect_vc";
          await this[command_name](interaction);
          break;
        case "setspeed":
        case "setpitch":
        case "setintonation":
          command_name = command_name.replace("set", "");
          await this.setvoice(interaction, command_name);
          break;
        case "setdefaultvoice":
          if(!(interaction.member.permissions.has('Administrator'))){
            await interaction.reply({ content: "権限がないよ！" });
            break;
          }
          await this.setvoiceall(interaction, "DEFAULT");
          break;
        case "defaultvoice":
          await this.currentvoice(interaction, "DEFAULT");
          break;
        default:
          // setvoiceは無限に増えるのでここで処理
          if(/setvoice[0-9]+/.test(interaction.commandName)){
            await this.setvoice(interaction, 'voice');
          }else{
            if (command_name === "credit") await command.execute(interaction, voice_library_list);
            await command.execute(interaction);
          }
          break;
      }
    } catch (error) {
      logger.info(error);
      try{
        await interaction.reply({ content: 'そんなコマンドないよ。' });
      }catch(e){
        // 元のインタラクションないのは知らない…
      }
    }
  }

  update_status_text(){
    client.user.setActivity(`${connections_map.size}本の接続`, { type: ActivityType.Playing });
  }

  is_target(msg){
    const connection = connections_map.get(msg.guild.id);

    return !(!connection || connection.text !== msg.channelId || msg.cleanContent.indexOf(PREFIX) === 0);
  }

  add_system_message(text, guild_id, voice_ref_id = "DEFAULT"){
    const connection = connections_map.get(guild_id);
    if(!connection) return;
    if(connection.system_mute_counter > 0){
      connection.system_mute_counter--;
      return;
    }

    text = Utils.replace_url(text);

    // 辞書と記号処理だけはやる
    // clean_messageに記号処理っぽいものしか残ってなかったのでそれを使う
    text = this.replace_at_dict(text, guild_id);
    logger.debug(`text(replace dict): ${text}`);

    let volume_order = bot_utils.get_command_volume(text);
    if(volume_order !== null) text = bot_utils.replace_volume_command(text);

    let voice_override = bot_utils.get_spell_voice(text);
    if(voice_override !== null) text = bot_utils.replace_voice_spell(text);

    text = Utils.clean_message(text);

    const q = { str: text, id: voice_ref_id, volume_order: volume_order };

    if(voice_override) q.voice_override = voice_override;

    connection.queue.push(q);
    this.play(guild_id);
  }

  async add_text_queue(msg, skip_discord_features = false){
    let content = msg.cleanContent;

    let connection = connections_map.get(msg.guild.id);
    if(!connection) return;

    logger.debug(`content(from): `);
    logger.debug(msg);

    // テキストの処理順
    // 0. テキスト追加系
    // 1. 辞書の変換
    // 2. ボイス、音量の変換
    // 3. 問題のある文字列の処理
    // 4. sudachiで固有名詞などの読みを正常化、英単語の日本語化

    // 0
    if(!skip_discord_features){
      if(msg.attachments.size !== 0) content = `添付ファイル、${content}`;

      if(msg.stickers.size !== 0){
        for(let i of msg.stickers.values()) content = `${i.name}、${content}`;
      }
    }

    content = Utils.replace_url(content);
   
    // 1
    content = this.replace_at_dict(content, msg.guild.id);
    logger.debug(`content(replace dict): ${content}`);
  
    // 2
    let volume_order = bot_utils.get_command_volume(content);
    if(volume_order !== null) content = bot_utils.replace_volume_command(content);

    let voice_override = bot_utils.get_spell_voice(content);
    if(voice_override !== null) content = bot_utils.replace_voice_spell(content);

    let is_extend = bot_utils.get_extend_flag(content);
    if(is_extend !== null) content = bot_utils.replace_extend_command(content);

    // 3
    content = Utils.clean_message(content);
    logger.debug(`content(clean): ${content}`);
    // 4

    const q = { str: content, id: msg.member.id, volume_order: volume_order, is_extend };

    connection = connections_map.get(msg.guild.id);
    logger.debug(`play connection: ${connection}`);
    if(!connection) return;

    if(voice_override) q.voice_override = voice_override;

    connection.queue.push(q);

    this.play(msg.guild.id);
  }

  async play(guild_id){
    // 接続ないなら抜ける
    const connection = connections_map.get(guild_id);
    if(!connection || connection.is_play || connection.queue.length === 0) return;

    connection.is_play = true;
    logger.debug(`play start`);

    const q = connection.queue.shift();
    // 何もないなら次へ
    if(!(q.str) || q.str.trim().length === 0){
      connection.is_play = false;
      this.play(guild_id);
      logger.debug(`play empty next`);
      return;
    }

    // connectionあるならデフォルトボイスはある
    // もしvoice_overrideがあるならそれを優先する
    let voice = q.voice_override ?? (connection.user_voices[q.id] ?? connection.user_voices["DEFAULT"]);
    logger.debug(`play voice: ${JSON.stringify(voice)}`);

    const text_data = Utils.get_text_and_speed(q.str);
    logger.debug(`play text speed: ${text_data.speed}`);

    // デバッグ時は省略せず全文読ませる
    if(this.status.debug){
      text_data.speed = voice.speed;
    }
    logger.debug(`Extend: ${q.is_extend}`);
    if(q.is_extend || this.status.debug){
      text_data.text = q.str;
    }

    const voice_data = {
      // 加速はユーザー設定と加速設定のうち速い方を利用する。
      speed: Utils.map_voice_setting(((voice.speed > text_data.speed) ? voice.speed : text_data.speed), 0.5, 1.5),
      pitch: Utils.map_voice_setting(voice.pitch, -0.15, 0.15),
      intonation: Utils.map_voice_setting(voice.intonation, 0, 2),
      volume: Utils.map_voice_setting((q.volume_order ?? voice.volume), 0, 1, 0, 100)
    };

    logger.debug(`voicedata: ${JSON.stringify(voice_data)}`);

    try{
      const voice_path = await voicevox.synthesis(text_data.text, connection.filename, voice.voice, voice_data);

      let opus_voice_path;

      if(this.config.opus_convert.enable){
        // Opusへの変換は失敗してもいいので入れ子にする
        try{
          opus_voice_path = await convert_audio(
            voice_path, `${TMP_DIR}/${connection.opus_filename}`,
            this.config.opus_convert.bitrate, this.config.opus_convert.threads
          );
        }catch(e){
          logger.info(e);
          opus_voice_path = null;
        }
      }

      let audio_res;
      if(this.config.opus_convert.enable && opus_voice_path){
        audio_res = createAudioResource(fs.createReadStream(opus_voice_path), {
          inputType: StreamType.OggOpus, inlineVolume: false
        });
      }else{
        audio_res = createAudioResource(voice_path, { inlineVolume: false });
      }

      logger.debug(`play voice path: ${opus_voice_path || audio_res}`);

      connection.audio_player.play(audio_res);
    }catch(e){
      logger.info(e);

      await sleep(10);
      connection.is_play = false;

      this.play(guild_id);
    }
  }

  replace_at_dict(text, guild_id){
    // 何故か接続ない場合はなにもしないで戻す
    const connection = connections_map.get(guild_id);
    if(!connection) return text;

    let result = text;

    for(let p = 0; p < 5; p++){
      const tmp_dict = connection.dict.filter(word => word[2] === p);

      for(let d of tmp_dict) result = result.replace(new RegExp(escape_regexp(d[0]), "g"), d[1]);
    }

    return result;
  }


  async connect_vc(interaction){
    const guild = interaction.guild;
    const member = await guild.members.fetch(interaction.member.id);
    const member_vc = member.voice.channel;

    if(!member_vc){
      await interaction.reply({ content: "接続先のVCが見つかりません。" });
      return;
    }
    if(!member_vc.joinable) {
      await interaction.reply({ content: "VCに接続できません。" });
      return;
    }
    if(!member_vc.speakable) {
      await interaction.reply({ content: "VCで音声を再生する権限がありません。" });
      return;
    }

    const voice_channel_id = member_vc.id;
    const guild_id = guild.id;

    const current_connection = connections_map.get(guild_id);

    if(current_connection){
      await interaction.reply({ content: "接続済みです。" });
      return;
    }

    const connectinfo = {
      text: interaction.channel.id,
      voice: voice_channel_id,
      audio_player: null,
      queue: [],
      filename: `${guild_id}${TMP_PREFIX}.wav`,
      opus_filename: `${guild_id}${TMP_PREFIX}.ogg`,
      is_play: false,
      system_mute_counter: 0,
      user_voices: {
        DEFAULT: { voice: 1, speed: 100, pitch: 100, intonation: 100, volume: 100 }
      },
      dict: [["Discord", "でぃすこーど", 2]],
    };

    const server_file = bot_utils.get_server_file(guild_id);

    connectinfo.user_voices = server_file.user_voices;
    connectinfo.dict = server_file.dict;
    const connection = joinVoiceChannel({
      guildId: guild_id,
      channelId: voice_channel_id,
      adapterCreator: guild.voiceAdapterCreator,
      selfMute: false, selfDeaf: true,
    });

    connection.on(VoiceConnectionStatus.Disconnected, async(_, __)=>{
      try{
        await Promise.race([
          entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
          entersState(connection, VoiceConnectionStatus.Connecting, 5_000),
        ]);
      }catch(e){
        try{
          // すでに接続が破棄されてる場合がある
          connection.destroy();
        }catch(e){
          logger.log(e);
        }

        logger.debug(`system disconnected`);
      }
    });

    const player = createAudioPlayer({ behaviors: { noSubscriber: NoSubscriberBehavior.Play } });
    connectinfo.audio_player = player;
    connection.subscribe(player);

    connection.on(VoiceConnectionStatus.Destroyed, async() => {
      player.stop();
      connections_map.delete(guild_id);
      this.update_status_text();
      logger.debug(`self disconnected`);
    });

    player.on(AudioPlayerStatus.Idle, async () => {
      logger.debug(`queue end`);
      await sleep(20);
      connectinfo.is_play = false;
      this.play(guild_id);
    });

    connections_map.set(guild_id, connectinfo);

    if(!this.status.debug){
      await interaction.reply({ content: '接続しました。' });
      this.add_system_message("接続しました！", guild_id);
    }

    this.update_status_text();
  }

  check_join_and_leave(old_s, new_s){
    const guild_id = new_s.guild.id;
    // 接続ないなら抜ける
    const connection = connections_map.get(guild_id);
    if(!connection) return;

    const member = new_s.member;
    if(member.user.bot) return;

    const new_voice_id = new_s.channelId;
    const old_voice_id = old_s.channelId;
    logger.debug(`old_voice_id: ${old_voice_id}`);
    logger.debug(`new_voice_id: ${new_voice_id}`);
    logger.debug(`con voice id: ${connection.voice}`);

    // 現在の監視対象じゃないなら抜ける
    if((connection.voice !== new_voice_id) && (connection.voice !== old_voice_id) && (old_voice_id === new_voice_id)) return;

    const is_join = (new_s.channelId === connection.voice);
    const is_leave = (old_s.channelId === connection.voice);

    logger.debug(`is_join: ${is_join}`);
    logger.debug(`is_leave: ${is_leave}`);
    logger.debug(`xor: ${xor(is_join, is_leave)}`);

    if(is_leave && old_s.channel && old_s.channel.members && old_s.channel.members.size === 1){
      const d_connection = getVoiceConnection(guild_id);
      d_connection.destroy();

      return;
    }

    if(!xor(is_join, is_leave)) return;

    let text = "にゃーん";
    if(is_join){
      text = `${member.displayName}さんが入室しました`;
    }else if(is_leave){
      text = `${member.displayName}さんが退出しました`;
    }

    this.add_system_message(text, guild_id, member.id);
  }

  skip_current_text(guild_id){
    // 接続ないなら抜ける
    const connection = connections_map.get(guild_id);
    if(!connection || !connection.is_play) return;

    connection.audio_player.stop(true);
  }

  async get_voicelist(){
    const list = await voicevox.speakers();

    const speaker_list = [];
    const lib_list = [];

    for(let sp of list){
      lib_list.push(sp.name);

      for(let v of sp.styles){
        let speaker = { name: `${sp.name}(${v.name})`, value: parseInt(v.id, 10) };

        speaker_list.push(speaker);
      }
    }

    return { speaker_list: speaker_list, voice_library_list: lib_list };
  }

  async setvoice(interaction, type){
    const guild_id = interaction.guild.id;
    const member_id = interaction.member.id;

    const connection = connections_map.get(guild_id);

    const server_file = bot_utils.get_server_file(guild_id);

    let voices = server_file.user_voices;

    let voice = { voice: 1, speed: 100, pitch: 100, intonation: 100, volume: 100 };

    voice = voices[member_id] ?? ({...(voices["DEFAULT"])} ?? voice);

    voice[type] = interaction.options.get(type).value;
    voices[member_id] = voice;

    bot_utils.write_serverinfo(guild_id, server_file, { user_voices: voices });

    if(connection) connection.user_voices = voices;

    let text = "";
    switch(type){
      case "voice":
        text = `声を${this.voice_list.find(el => parseInt(el.value, 10) === interaction.options.get("voice").value).name}に変更しました。`;
        break;
      case "speed":
        text = `声の速度を${interaction.options.get('speed').value}に変更しました。`;
        break;
      case "pitch":
        text = `声のピッチを${interaction.options.get('pitch').value}に変更しました。`;
        break;
      case "intonation":
        text = `声のイントネーションを${interaction.options.get('intonation').value}に変更しました。`;
        break;
    }

    await interaction.reply({ content: text });
  }

  async setvoiceall(interaction, override_id = null){
    const guild_id = interaction.guild.id;
    const member_id = override_id ?? interaction.member.id;

    const connection = connections_map.get(guild_id);

    const server_file = bot_utils.get_server_file(guild_id);

    let voices = server_file.user_voices;

    let voice = interaction.options.get("voiceall").value;
    try{
      voice = ResurrectionSpell.decode(voice);
      // もしボイスなければID0にフォールバック
      if(!(this.voice_list.find(el => parseInt(el.value, 10) === voice.voice))) voice.voice = 0;
    }catch(e){
      logger.debug(e);
      await interaction.reply({ content: "ふっかつのじゅもんが違います！" });
      return;
    }

    if(!(this.voice_list.find(el => parseInt(el.value, 10) === voice.voice))){
      await interaction.reply({ content: "ふっかつのじゅもんが違います！" });
      return;
    }

    voices[member_id] = voice;

    bot_utils.write_serverinfo(guild_id, server_file, { user_voices: voices });

    if(connection) connection.user_voices = voices;

    let name = interaction.member.displayName;
    if(override_id === "DEFAULT") name = "デフォルト";

    const em = new EmbedBuilder()
      .setTitle(`${name}の声設定を変更しました。`)
      .addFields(
        { name: "声の種類(voice)", value: (this.voice_list.find(el => parseInt(el.value, 10) === voice.voice)).name },
        { name: "声の速度(speed)", value: `${voice.speed}`},
        { name: "声のピッチ(pitch)", value: `${voice.pitch}`},
        { name: "声のイントネーション(intonation)", value: `${voice.intonation}`},
      );

    await interaction.reply({ embeds: [em] });
  }

  async currentvoice(interaction, override_id = null){
    const member_id = override_id ?? interaction.member.id;

    const server_file = bot_utils.get_server_file(interaction.guild.id);

    let voices = server_file.user_voices;

    let sample_voice_info = { voice: 1, speed: 100, pitch: 100, intonation: 100, volume: 100 };

    let is_default = false;
    let is_not_exist_server_settings = false;

    if(!(voices[member_id])){
      // ないならとりあえずデフォルト判定
      is_default = true;

      // もしサーバー設定もないなら(=1回もVCに入ってないなら)フラグだけ生やしてシステムの設定を持ってくる
      if(voices["DEFAULT"]) sample_voice_info = voices["DEFAULT"];
      else is_not_exist_server_settings = true;
    }else{
      sample_voice_info = voices[member_id];
    }

    let name = interaction.member.displayName;
    if(member_id === "DEFAULT") name = "デフォルト";

    const em = new EmbedBuilder()
      .setTitle(`${name}の声設定`)
      .addFields(
        { name: "声の種類(voice)", value: (this.voice_list.find(el => parseInt(el.value, 10) === sample_voice_info.voice)).name },
        { name: "声の速度(speed)", value: `${sample_voice_info.speed}`},
        { name: "声のピッチ(pitch)", value: `${sample_voice_info.pitch}`},
        { name: "声のイントネーション(intonation)", value: `${sample_voice_info.intonation}`},
      )
      .addFields(
        { name: "ふっかつのじゅもん", value: ResurrectionSpell.encode(`${sample_voice_info.voice},${sample_voice_info.speed},${sample_voice_info.pitch},${sample_voice_info.intonation}`)},
      );

    if(member_id !== "DEFAULT" && is_default){
      if(is_not_exist_server_settings){
        em.setDescription("注意: あなたの声設定はこのサーバーのデフォルト声設定ですが、サーバーのデフォルト声設定が生成されていないため正確ではない場合があります。")
      }else{
        em.setDescription("注意: あなたの声設定はこのサーバーのデフォルト声設定です。サーバーのデフォルト声設定が変更された場合はそれに追従します。");
      }
    }

    await interaction.reply({ embeds: [em] });
  }

  async resetconnection(interaction){
    const guild_id = interaction.guild.id;

    const vc_con = getVoiceConnection(guild_id);
    if(vc_con) vc_con.destroy();

    const connection = connections_map.get(guild_id);
    if(connection) connection.audio_player.stop();
    connections_map.delete(guild_id);

    this.update_status_text();

    interaction.reply({ content: "どっかーん！" })
  }

  async dicadd(interaction){
    const guild_id = interaction.guild.id;

    const connection = connections_map.get(guild_id);

    const server_file = bot_utils.get_server_file(guild_id);
    let dict = server_file.dict;

    const word_from = interaction.options.get("from").value;
    const word_to = interaction.options.get("to").value;

    for(let d of dict){
      if(d[0] === word_from){
        interaction.reply({ content: "既に登録されています！" });
        return;
      }
    }

    dict.push([word_from, word_to, 2]);

    bot_utils.write_serverinfo(guild_id, server_file, { dict: dict });

    if(connection) connection.dict = dict;

    const em = new EmbedBuilder()
      .setTitle(`登録しました。`)
      .addFields(
        { name: "変換元", value: `${word_from}`},
        { name: "変換先", value: `${word_to}`},
      );

    await interaction.reply({ embeds: [em] });
  }


  async dicdel(interaction){
    const guild_id = interaction.guild.id;

    const connection = connections_map.get(guild_id);

    const server_file = bot_utils.get_server_file(guild_id);
    let dict = server_file.dict;

    const target = interaction.options.get("target").value;

    let exist = false;

    for(let d of dict){
      if(d[0] === target){
        exist = true;
        break;
      }
    }

    if(!exist){
      await interaction.reply({ content: "ないよ" });
      return;
    }

    dict = dict.filter(word => word[0] !== target);

    bot_utils.write_serverinfo(guild_id, server_file, { dict: dict });

    if(connection) connection.dict = dict;

    await interaction.reply({ content: "削除しました。" });
  }

  async dicedit(interaction){
    const guild_id = interaction.guild.id;

    const connection = connections_map.get(guild_id);

    const server_file = bot_utils.get_server_file(guild_id);
    let dict = server_file.dict;

    const word_from = interaction.options.get("from").value;
    const word_to = interaction.options.get("to").value;

    let exist = false;

    for(let d of dict){
      if(d[0] === word_from){
        exist = true;
        break;
      }
    }

    if(!exist){
      await interaction.reply({ content: "ないよ" });
      return;
    }

    dict = dict.map(val => {
      let result = val;
      if(val[0] === word_from) result[1] = word_to;

      return result;
    });

    bot_utils.write_serverinfo(guild_id, server_file, { dict: dict });

    if(connection) connection.dict = dict;

    const em = new EmbedBuilder()
      .setTitle(`編集しました。`)
      .addFields(
        { name: "変換元", value: `${word_from}`},
        { name: "変換先", value: `${word_to}`},
      );

    await interaction.reply({ embeds: [em] });
  }

  async dicpriority(interaction){
    const guild_id = interaction.guild.id;

    const connection = connections_map.get(guild_id);

    const server_file = bot_utils.get_server_file(guild_id);
    let dict = server_file.dict;

    const target = interaction.options.get("target").value;
    const priority = interaction.options.get("priority").value;

    let exist = false;

    for(let d of dict){
      if(d[0] === target){
        exist = true;
        break;
      }
    }

    if(!exist){
      await interaction.reply({ content: "ないよ" });
      return;
    }

    dict = dict.map(val => {
      let result = val;
      if(val[0] === target) result[2] = priority;

      return result;
    });

    bot_utils.write_serverinfo(guild_id, server_file, { dict: dict });

    if(connection) connection.dict = dict;

    const em = new EmbedBuilder()
      .setTitle(`設定しました。`)
      .addFields(
        { name: "単語", value: `${target}`},
        { name: "優先度", value: `${priority_list[priority]}`},
      );

    await interaction.reply({ embeds: [em] });
  }

  async systemvoicemute(interaction){
    const connection = connections_map.get(interaction.guild.id);

    if(!connection){
      await interaction.reply("接続がないよ！");
      return;
    }

    connection.system_mute_counter++;

    await interaction.reply(`${connection.system_mute_counter}回システムボイスをミュートするよ`);
  }

  async copyvoicesay(interaction){
    const guild_id = interaction.guild.id;

    const connection = connections_map.get(guild_id);

    if(!connection){
      await interaction.reply({ content: "接続ないよ" });
      return;
    }

    let voice_target = interaction.options.get('user').value;
    let text = interaction.options.get('text').value;

    // add_text_queue が利用している部分だけ満たすObjectを作る
    let msg_obj = {
      cleanContent: text,
      guild:{ id: guild_id },
      member: { id: voice_target }
    }

    this.add_text_queue(msg_obj, true);

    await interaction.reply({ content: "まかせて！" });
  }

  async info(interaction){
    const server_file = bot_utils.get_server_file(interaction.guild.id);

    const ram = Math.round(process.memoryUsage.rss() / 1024 / 1024 * 100) / 100;
    const total_ram = Math.round(os.totalmem() / (1024 * 1024));

    const cyan = "\x1b[1;36m";
    const gray = "\x1b[1;30m";
    const reset = "\x1b[1;0m";

    const em = new EmbedBuilder()
      .setTitle(`Infomations`)
      .setDescription(`
\`\`\`ansi
${cyan}API Ping${gray}:${reset} ${client.ws.ping} ms
${cyan}メモリ${gray}:${reset} ${ram} MB / ${total_ram} MB
${cyan}現在接続数${gray}:${reset} ${connections_map.size}

${cyan}サーバー数${gray}:${reset} ${this.status.connected_servers}
${cyan}利用可能なボイス数${gray}:${reset} ${this.voice_list.length}
\`\`\`
      `)
      .addFields(
        {
          name: "Bot設定",
          value: `
\`\`\`ansi
${cyan}Opus変換${gray}:${reset} ${ans(this.status.opus_convert_available && this.config.opus_convert.enable, "有効", "無効")}
${cyan}英語辞書変換${gray}:${reset} ${ans(this.status.remote_replace_available, "有効", "無効")}
${cyan}サーバー辞書単語数${gray}:${reset} ${this.dictionaries.length}
\`\`\`
          `,
          inline: true
        },
      ).addFields(
        {
          name: "サーバー設定",
          value: `
\`\`\`ansi
${cyan}辞書単語数${gray}:${reset} ${server_file.dict.length}
${cyan}ボイス登録数${gray}:${reset} ${Object.keys(server_file.user_voices).length}
\`\`\`
          `,
          inline: true
        }
      )

    await interaction.reply({ embeds: [em] });
  }
}
