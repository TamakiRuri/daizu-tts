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
global.voice_list = [];

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
    global.voice_list = global.voice_list;
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
    global.voice_list = voiceinfos.speaker_list;
    voice_library_list = voiceinfos.voice_library_list;

    logger.debug(global.voice_list);
    logger.debug(voice_library_list);

    bot_utils.init_voicelist(global.voice_list, voice_library_list);

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

    for(let i = 0; i < Math.ceil(global.voice_list.length/MAXCHOICE); i++){
      const start = i * MAXCHOICE;
      const end = (i + 1) * MAXCHOICE;

      const setvoice_command = {
        name: `setvoice${i + 1}`,
        description: `声を設定します。(${i + 1}ページ目)`,
        options: [
          {
            type: ApplicationCommandOptionType.Integer,
            name: "voice",
            description: "声",
            required: true,
            choices: global.voice_list.slice(start, end)
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
        vc_process.add_text_queue.bind(vc_process)(msg);
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
          await vc_process.connect_vc.bind(vc_process)(interaction, false);
          break;
        case "copyvoicesay":
          await command.execute(interaction, vc_process);
          break;
        case "setspeed":
        case "setpitch":
        case "setintonation":
          command_name = command_name.replace("set", "");
          await this.setvoice(interaction, command_name);
          break;
        case "credit":
          await command.execute(interaction, voice_library_list);
          break;
        case "info":
          await command.execute(interaction, this);
          break;
        default:
          // setvoiceは無限に増えるのでここで処理
          if(/setvoice[0-9]+/.test(interaction.commandName)){
            await this.setvoice(interaction, 'voice');
          }else{
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

  check_join_and_leave(old_s, new_s) {
    const guild_id = new_s.guild.id;
    // 接続ないときに接続する
    const connection = global.connections_map.get(guild_id);
    const serverFile = bot_utils.get_server_file(guild_id);
    
    if (serverFile) {
        if (! connection && serverFile.autojoin && new_s.channel != null) {
            if (global.vcPauseMap.get(guild_id) === true) return;
            vc_process.connect_vc.bind(vc_process)(new_s, true);
            return;
        }
    }
    if (! connection) {
        return;
    }

    const member = new_s.member;
    if (member.user.bot) 
        return;
    

    const new_voice_id = new_s.channelId;
    const old_voice_id = old_s.channelId;
    logger.debug(`old_voice_id: ${old_voice_id}`);
    logger.debug(`new_voice_id: ${new_voice_id}`);
    logger.debug(`con voice id: ${
        connection.voice
    }`);

    // 現在の監視対象じゃないなら抜ける
    if ((connection.voice !== new_voice_id) && (connection.voice !== old_voice_id) && (old_voice_id === new_voice_id)) 
        return;
    

    const is_join = (new_s.channelId === connection.voice);
    const is_leave = (old_s.channelId === connection.voice);

    logger.debug(`is_join: ${is_join}`);
    logger.debug(`is_leave: ${is_leave}`);
    logger.debug(`xor: ${
        xor(is_join, is_leave)
    }`);

    if (is_leave && old_s.channel && old_s.channel.members && old_s.channel.members.size === 1) {
        const d_connection = getVoiceConnection(guild_id);
        d_connection.destroy();

        return;
    }

    if (! xor(is_join, is_leave)) 
        return;
    

    let text = "にゃーん";
    if (is_join) {
        text = `${
            member.displayName
        }さんが入室しました`;
    } else if (is_leave) {
        text = `${
            member.displayName
        }さんが退出しました`;
    }

    vc_process.add_system_message.bind(vc_process)(text, guild_id, member.id);
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
        text = `声を${global.voice_list.find(el => parseInt(el.value, 10) === interaction.options.get("voice").value).name}に変更しました。`;
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



}