"use strict";
const {
    joinVoiceChannel,
    createAudioResource,
    entersState,
    getVoiceConnection,
    createAudioPlayer,
    NoSubscriberBehavior,
    VoiceConnectionStatus,
    AudioPlayerStatus
} = require("@discordjs/voice");
// const {Client, Collection} = require('discord.js');
const log4js = require('log4js');

const BotUtils = require('./bot_utils.js');
const Utils = require('./utils.js');

const sleep = waitTime => new Promise(resolve => setTimeout(resolve, waitTime));
const xor = (a, b) => ((a || b) && !(a && b));
const escape_regexp = (str) => str.replace(/[.*+\-?^${}()|[\]\\]/g, '\\$&');

let logger = log4js.getLogger();
const bot_utils = new BotUtils(logger);

const {
    PREFIX,
    TMP_DIR,
    OPUS_CONVERT,
    DICT_DIR,
    TMP_PREFIX
} = require('../config.json');

module.exports = class VoiceProcessing {
    constructor(client) {
        this.client = client;
        this.voicevox = global.voicevox;
        this.config = {
            opus_convert: {
                enable: false,
                bitrate: '96k',
                threads: 2
            }
        }

        this.status = {
            debug: !(process.env.NODE_ENV === "production")
        }
    }


    // BAD IMPLEMENTATION
    // いまではinteractionとVOICESTATEを共有することになっております！
    // NEED IMPROVEMENT
    async connect_vc(interaction, auto = false) {
        const guild = interaction.guild;
        const member = await guild.members.fetch(interaction.member.id);

        let voice_channel_id = null;

        if (auto) {
            voice_channel_id = interaction.channel.id;
            // VC入室の一時停止を終了
            global.vcPauseMap.set(interaction.guildId, false);
        } else {
            const member_vc = member.voice.channel;
            if (! member_vc) {
                await interaction.reply({content: "接続先のVCが見つかりません。"});
                return;
            }
            if (! member_vc.joinable) {
                await interaction.reply({content: "VCに接続できません。"});
                return;
            }
            if (! member_vc.speakable) {
                await interaction.reply({content: "VCで音声を再生する権限がありません。"});
                return;
            }
            voice_channel_id = member_vc.id;
        }

        const guild_id = guild.id;

        const current_connection = global.connections_map.get(guild_id);

        if (current_connection) {
            await interaction.reply({content: "接続済みです。"});
            return;
        }
        const serverFile = bot_utils.get_server_file(interaction.guild.id);
        let text_channel = null;
        if (auto && serverFile.textchannel !== null) {
            text_channel = serverFile.textchannel;
        } else 
            text_channel = interaction.channel.id;
        

        const connectinfo = {
            text: text_channel,
            voice: voice_channel_id,
            audio_player: null,
            queue: [],
            filename: `${guild_id}${TMP_PREFIX}.wav`,
            opus_filename: `${guild_id}${TMP_PREFIX}.ogg`,
            is_play: false,
            system_mute_counter: 0,
            user_voices: {
                DEFAULT: {
                    voice: 1,
                    speed: 100,
                    pitch: 100,
                    intonation: 100,
                    volume: 100
                }
            },
            dict: [
                ["Discord", "でぃすこーど", 2]
            ]
        };

        const server_file = bot_utils.get_server_file(guild_id);

        connectinfo.user_voices = server_file.user_voices;
        connectinfo.dict = server_file.dict;
        const connection = joinVoiceChannel({
            guildId: guild_id,
            channelId: voice_channel_id,
            adapterCreator: guild.voiceAdapterCreator,
            selfMute: false,
            selfDeaf: true
        });

        connection.on(VoiceConnectionStatus.Disconnected, async (_, __) => {
            try {
                await Promise.race([
                    entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
                    entersState(connection, VoiceConnectionStatus.Connecting, 5_000),
                ]);
            } catch (e) {
                try { // すでに接続が破棄されてる場合がある
                    connection.destroy();
                } catch (e) {
                    logger.log(e);
                }

                logger.debug(`system disconnected`);
            }
        });

        const player = createAudioPlayer({
            behaviors: {
                noSubscriber: NoSubscriberBehavior.Play
            }
        });
        connectinfo.audio_player = player;
        connection.subscribe(player);

        connection.on(VoiceConnectionStatus.Destroyed, async () => {
            player.stop();
            global.connections_map.delete(guild_id);
            bot_utils.update_status_text(this.client);
            logger.debug(`self disconnected`);
        });

        player.on(AudioPlayerStatus.Idle, async () => {
            logger.debug(`queue end`);
            await sleep(20);
            connectinfo.is_play = false;
            this.play(guild_id);
        });

        global.connections_map.set(guild_id, connectinfo);

        if (!this.status.debug) {
            if (!auto) 
                await interaction.reply({content: '接続しました。'});
            
            this.add_system_message("接続しました！", guild_id);
        }

        bot_utils.update_status_text(this.client);
    }
    add_system_message(text, guild_id, voice_ref_id = "DEFAULT") {
        const connection = global.connections_map.get(guild_id);
        if (! connection) 
            return;
        
        if (connection.system_mute_counter > 0) {
            connection.system_mute_counter --;
            return;
        }

        text = Utils.replace_url(text);

        // 辞書と記号処理だけはやる
        // clean_messageに記号処理っぽいものしか残ってなかったのでそれを使う
        text = this.replace_at_dict(text, guild_id);
        logger.debug(`text(replace dict): ${text}`);

        let volume_order = bot_utils.get_command_volume(text);
        if (volume_order !== null) 
            text = bot_utils.replace_volume_command(text);
        

        let voice_override = bot_utils.get_spell_voice(text);
        if (voice_override !== null) 
            text = bot_utils.replace_voice_spell(text);
        

        text = Utils.clean_message(text);

        const q = {
            str: text,
            id: voice_ref_id,
            volume_order: volume_order
        };

        if (voice_override) 
            q.voice_override = voice_override;
        

        connection.queue.push(q);
        this.play(guild_id);
    }
    async add_text_queue(msg, skip_discord_features = false) {
        let content = msg.cleanContent;

        let connection = global.connections_map.get(msg.guild.id);
        if (! connection) 
            return;
        

        logger.debug(`content(from): `);
        logger.debug(msg);

        // テキストの処理順
        // 0. テキスト追加系
        // 1. 辞書の変換
        // 2. ボイス、音量の変換
        // 3. 問題のある文字列の処理
        // 4. sudachiで固有名詞などの読みを正常化、英単語の日本語化

        // 0
        if (!skip_discord_features) {
            if (msg.attachments.size !== 0) 
                content = `添付ファイル、${content}`;
            

            if (msg.stickers.size !== 0) {
                for (let i of msg.stickers.values()) 
                    content = `${
                        i.name
                    }、${content}`;
                
            }
        }

        content = Utils.replace_url(content);

        // 1
        content = this.replace_at_dict(content, msg.guild.id);
        logger.debug(`content(replace dict): ${content}`);

        // 2
        let volume_order = bot_utils.get_command_volume(content);
        if (volume_order !== null) 
            content = bot_utils.replace_volume_command(content);
        

        let voice_override = bot_utils.get_spell_voice(content);
        if (voice_override !== null) 
            content = bot_utils.replace_voice_spell(content);
        

        let is_extend = bot_utils.get_extend_flag(content);
        if (is_extend !== null) 
            content = bot_utils.replace_extend_command(content);
        

        // 3
        content = Utils.clean_message(content);
        logger.debug(`content(clean): ${content}`);
        // 4

        const q = {
            str: content,
            id: msg.member.id,
            volume_order: volume_order,
            is_extend
        };

        connection = global.connections_map.get(msg.guild.id);
        logger.debug(`play connection: ${connection}`);
        if (! connection) 
            return;
        

        if (voice_override) 
            q.voice_override = voice_override;
        

        connection.queue.push(q);

        this.play(msg.guild.id);
    }

    async play(guild_id) { // 接続ないなら抜ける
        const connection = global.connections_map.get(guild_id);
        if (! connection || connection.is_play || connection.queue.length === 0) 
            return;
        

        connection.is_play = true;
        logger.debug(`play start`);

        const q = connection.queue.shift();
        // 何もないなら次へ
        if (!(q.str) || q.str.trim().length === 0) {
            connection.is_play = false;
            this.play(guild_id);
            logger.debug(`play empty next`);
            return;
        }

        // connectionあるならデフォルトボイスはある
        // もしvoice_overrideがあるならそれを優先する
        let voice = q.voice_override ?? (connection.user_voices[q.id] ?? connection.user_voices["DEFAULT"]);
        logger.debug(`play voice: ${
            JSON.stringify(voice)
        }`);

        const text_data = Utils.get_text_and_speed(q.str);
        logger.debug(`play text speed: ${
            text_data.speed
        }`);

        // デバッグ時は省略せず全文読ませる
        if (this.status.debug) {
            text_data.speed = voice.speed;
        }
        logger.debug(`Extend: ${
            q.is_extend
        }`);
        if (q.is_extend || this.status.debug) {
            text_data.text = q.str;
        }

        const voice_data = { // 加速はユーザー設定と加速設定のうち速い方を利用する。
            speed: Utils.map_voice_setting(
                ((voice.speed > text_data.speed) ? voice.speed : text_data.speed),
                0.5,
                1.5
            ),
            pitch: Utils.map_voice_setting(voice.pitch, -0.15, 0.15),
            intonation: Utils.map_voice_setting(voice.intonation, 0, 2),
            volume: Utils.map_voice_setting(
                (q.volume_order ?? voice.volume),
                0,
                1,
                0,
                100
            )
        };

        logger.debug(`voicedata: ${
            JSON.stringify(voice_data)
        }`);

        try {
            const voice_path = await this.voicevox.synthesis(text_data.text, connection.filename, voice.voice, voice_data);

            let opus_voice_path;

            if (this.config.opus_convert.enable) { // Opusへの変換は失敗してもいいので入れ子にする
                try {
                    opus_voice_path = await convert_audio(voice_path, `${TMP_DIR}/${
                        connection.opus_filename
                    }`, this.config.opus_convert.bitrate, this.config.opus_convert.threads);
                } catch (e) {
                    logger.info(e);
                    opus_voice_path = null;
                }
            }

            let audio_res;
            if (this.config.opus_convert.enable && opus_voice_path) {
                audio_res = createAudioResource(fs.createReadStream(opus_voice_path), {
                    inputType: StreamType.OggOpus,
                    inlineVolume: false
                });
            } else {
                audio_res = createAudioResource(voice_path, {inlineVolume: false});
            } logger.debug(`play voice path: ${
                opus_voice_path || audio_res
            }`);

            connection.audio_player.play(audio_res);
        } catch (e) {
            logger.info(e);

            await sleep(10);
            connection.is_play = false;

            this.play(guild_id);
        }
    }
    check_join_and_leave(old_s, new_s) {
        // console.log(this);
        const guild_id = new_s.guild.id;
        // 接続ないときに接続する
        const connection = global.connections_map.get(guild_id);
        const serverFile = bot_utils.get_server_file(guild_id);
        if (global.vcPauseMap.get(guild_id) === true) return;
        if (serverFile) {
            if (! connection && serverFile.autojoin && new_s.channel != null) {
                this.connect_vc(new_s, true);
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

        this.add_system_message(text, guild_id, member.id);
    }
    replace_at_dict(text, guild_id) { // 何故か接続ない場合はなにもしないで戻す
        const connection = global.connections_map.get(guild_id);
        if (! connection) 
            return text;
        

        let result = text;

        for (let p = 0; p < 5; p++) {
            const tmp_dict = connection.dict.filter(word => word[2] === p);

            for (let d of tmp_dict) 
                result = result.replace(new RegExp(escape_regexp(d[0]), "g"), d[1]);
            
        }

        return result;
    }

}
