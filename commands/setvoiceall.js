const { ApplicationCommandOptionType,EmbedBuilder } = require('discord.js');

const log4js = require('log4js');
const BotUtils = require('../src/bot_utils.js');

let logger = log4js.getLogger();
const bot_utils = new BotUtils(logger);

const ResurrectionSpell = require('./resurrection_spell.js');

module.exports = {
  data: {
    name: "setvoiceall",
    description: "ふっかつのじゅもんで一括で自分の声を設定します。",
    options: [
      {
        type: ApplicationCommandOptionType.String,
        name: "voiceall",
        description: "ふっかつのじゅもん",
        required: true,
        min_length: 7
      }
    ]
  },
  async execute(interaction, override_id = null){
    const guild_id = interaction.guild.id;
    const member_id = override_id ?? interaction.member.id;

    const connection = global.connections_map.get(guild_id);

    const server_file = bot_utils.get_server_file(guild_id);

    let voices = server_file.user_voices;

    let voice = interaction.options.get("voiceall").value;
    try{
      voice = ResurrectionSpell.decode(voice);
      // もしボイスなければID0にフォールバック
      if(!(global.voice_list.find(el => parseInt(el.value, 10) === voice.voice))) voice.voice = 0;
    }catch(e){
      logger.debug(e);
      await interaction.reply({ content: "ふっかつのじゅもんが違います！" });
      return;
    }

    if(!(global.voice_list.find(el => parseInt(el.value, 10) === voice.voice))){
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
        { name: "声の種類(voice)", value: (global.voice_list.find(el => parseInt(el.value, 10) === voice.voice)).name },
        { name: "声の速度(speed)", value: `${voice.speed}`},
        { name: "声のピッチ(pitch)", value: `${voice.pitch}`},
        { name: "声のイントネーション(intonation)", value: `${voice.intonation}`},
      );

    await interaction.reply({ embeds: [em] });
  }
}
