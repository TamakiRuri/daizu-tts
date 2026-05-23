const {EmbedBuilder} = require('discord.js');
const log4js = require('log4js');
const BotUtils = require('../src/bot_utils.js');

let logger = log4js.getLogger();
const bot_utils = new BotUtils(logger);

const ResurrectionSpell = require('../src/resurrection_spell.js');
module.exports = {
  data: {
    name: "defaultvoice",
    description: "デフォルトの声の設定を表示します。"
  },
  async execute(interaction){
    const server_file = bot_utils.get_server_file(interaction.guild.id);

    let voices = server_file.user_voices;

    let sample_voice_info = { voice: 1, speed: 100, pitch: 100, intonation: 100, volume: 100 };

      // もしサーバー設定ないなら(=1回もVCに入ってないなら)フラグだけ生やしてシステムの設定を持ってくる
      if(voices["DEFAULT"]) sample_voice_info = voices["DEFAULT"];

    const em = new EmbedBuilder()
      .setTitle(`デフォルトの声設定`)
      .addFields(
        { name: "声の種類(voice)", value: (global.voice_list.find(el => parseInt(el.value, 10) === sample_voice_info.voice)).name },
        { name: "声の速度(speed)", value: `${sample_voice_info.speed}`},
        { name: "声のピッチ(pitch)", value: `${sample_voice_info.pitch}`},
        { name: "声のイントネーション(intonation)", value: `${sample_voice_info.intonation}`},
      )
      .addFields(
        { name: "ふっかつのじゅもん", value:`ふっかつのじゅもんはサーバーのボイスを一括設定で使用できます`},
        { name: "　", value: ResurrectionSpell.encode(`${sample_voice_info.voice},${sample_voice_info.speed},${sample_voice_info.pitch},${sample_voice_info.intonation}`)},
      );
    await interaction.reply({ embeds: [em] });
  }
}
