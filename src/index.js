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
// const { isRomaji, toKana } = require('wanakana');
const log4js = require('log4js');

const Voicevox = require('./voicevox.js');
const ResurrectionSpell = require('./resurrection_spell.js');
const Utils = require('./utils.js');
const BotUtils = require('./bot_utils.js');
const VCProcess = require('./vc_process.js');
const convert_audio = require('./convert_audio.js');
const print_info = require('./print_info.js');

const sleep = waitTime => new Promise( resolve => setTimeout(resolve, waitTime) );
const xor = (a, b) => ((a || b) && !(a && b));
const escape_regexp = (str) => str.replace(/[.*+\-?^${}()|[\]\\]/g, '\\$&');
const ans = (flag, true_text, false_text) => {
  return flag ? true_text:false_text;
};


//初期化など

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent
  ]
});

client.commands = new Collection();

global.voicevox = new Voicevox();

let logger = log4js.getLogger();
const bot_utils = new BotUtils(logger);
const vc_process = new VCProcess(client);

global.connections_map = new Map();

global.channelMap = new Map();
global.vcTimeMap = new Map();
global.vcServerMap = new Map();
global.vcPauseMap = new Map();

let voice_library_list = [];


// Discordで選択肢作ると25個が限界
const MAXCHOICE = 25;
const SKIP_PREFIX = "s";

const {
  TOKEN, PREFIX, TMP_DIR, OPUS_CONVERT, DICT_DIR, TMP_PREFIX
} = require('../config.json');
const { connect } = require("http2");

module.exports = class App{
  constructor(){
    this.voicevox = global.voicevox;
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
      extend_enabled: bot_utils.EXTEND_ENABLE
    };


    logger.level = this.status.debug ? 'debug' : 'info';

  }

  async start(){
    this.setup_config();
    await this.setup_voicevox();
    await this.test_opus_convert();
    this.setup_dictionaries();
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
    await this.voicevox.check_version();
    const voiceinfos = await this.get_voicelist();
    this.voice_list = voiceinfos.speaker_list;
    voice_library_list = voiceinfos.voice_library_list;

    logger.debug(this.voice_list);
    logger.debug(voice_library_list);

    bot_utils.init_voicelist(this.voice_list, voice_library_list);

    const tmp_voice = { speed: 1, pitch: 0, intonation: 1, volume: 1 };

    try{
      await this.voicevox.synthesis("てすと", `test${TMP_PREFIX}.wav`, 0, tmp_voice);
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

    // ./eventsから追加のイベントハンドルを読み込む
  const eventFiles = fs.readdirSync('./events').filter(file => file.endsWith('.js'));
  for (const file of eventFiles) {
	  const event = require(`../events/${file}`);
	  if (event.once) {
		  client.once(event.name, (...args) => event.execute(...args));
	  } else {
		  client.on(event.name, (...args) => event.execute(...args));
	  }
  }

    client.on('clientReady', async () => {
      // コマンド登録
      let data = [];
      for(const commandName in this.commands) data.push(this.commands[commandName].data);

      data = data.concat(setvoice_commands);
      logger.debug(data);

      await client.application.commands.set(data);

      this.status.connected_servers = client.guilds.cache.size;
      this.status.discord_username = client.user.displayName;

      print_info(this);

      bot_utils.update_status_text(client);
    });

    client.on('interactionCreate', this.onInteraction.bind(this));

    client.on('messageCreate', (msg) => {
      if(!(msg.guild) || msg.author.bot) return;

      if(msg.content === SKIP_PREFIX){
        this.skip_current_text(msg.guild.id);
        return;
      }

      if(this.is_target(msg)){
        vc_process.add_text_queue(msg);
      }
    });

    client.on('voiceStateUpdate', vc_process.check_join_and_leave.bind(vc_process));
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
          await vc_process.connect_vc(interaction, false);
          break;
        case "setvoiceall":
        case "currentvoice":
        case "resetconnection":
        case "copyvoicesay":
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
            if (command_name === "info") await command.execute(interaction, this);
            await command.execute(interaction);
          }
          break;
      }
    } catch (error) {
      logger.info(error);
      try{
        await interaction.reply({ content: 'コマンドを実行するときにエラーが発生しました', ephemeral: true });
      }catch(e){
        // 元のインタラクションないのは知らない…
      }
    }
  }

  is_target(msg){
    const connection = global.connections_map.get(msg.guild.id);

    return !(!connection || connection.text !== msg.channelId || msg.cleanContent.indexOf(PREFIX) === 0);
  }



  skip_current_text(guild_id){
    // 接続ないなら抜ける
    const connection = global.connections_map.get(guild_id);
    if(!connection || !connection.is_play) return;

    connection.audio_player.stop(true);
  }

  async get_voicelist(){
    const list = await this.voicevox.speakers();

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

    const connection = global.connections_map.get(guild_id);

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

    const connection = global.connections_map.get(guild_id);

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

    const connection = global.connections_map.get(guild_id);
    if(connection) connection.audio_player.stop();
    global.connections_map.delete(guild_id);

    bot_utils.update_status_text(client);

    interaction.reply({ content: "どっかーん！" })
  }


  async copyvoicesay(interaction){
    const guild_id = interaction.guild.id;

    const connection = global.connections_map.get(guild_id);

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

    vc_process.add_text_queue(msg_obj, true);

    await interaction.reply({ content: "まかせて！" });
  }
}