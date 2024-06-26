const {EmbedBuilder } = require('discord.js');

const BotUtils = require('../src/bot_utils');
const os = require('os');
const log4js = require('log4js');

let logger = log4js.getLogger();
const bot_utils = new BotUtils(logger);

const ans = (flag, true_text, false_text) => {
  return flag ? true_text:false_text;
};

module.exports = {
  data: {
    name: "info",
    description: "このBotの設定とサーバー固有の設定について。"
  },
  async execute(interaction,App){
    const server_file = bot_utils.get_server_file(interaction.guild.id);

    const ram = Math.round(process.memoryUsage.rss() / 1024 / 1024 * 100) / 100;
    const total_ram = Math.round(os.totalmem() / (1024 * 1024));
    const cyan = "\x1b[1;36m";
    const gray = "\x1b[1;30m";
    const reset = "\x1b[1;0m";


    // App.statusでundefinedというエラーメッセージが出ますが出力に問題がない
    const em = new EmbedBuilder()
      .setTitle(`Infomations`)
      .setDescription(`
\`\`\`ansi
${cyan}メモリ${gray}:${reset} ${ram} MB / ${total_ram} MB
${cyan}現在接続数${gray}:${reset} ${global.connections_map.size}
${cyan}API Ping${gray}:${reset} ${interaction.client.ws.ping} ms 
${cyan}サーバー数${gray}:${reset} ${App.status.connected_servers}
${cyan}利用可能なボイス数${gray}:${reset} ${App.voice_list.length}
\`\`\`
      `)
      .addFields(
        {
          name: "Bot設定",
          value: `
\`\`\`ansi
${cyan}Opus変換${gray}:${reset} ${ans(App.status.opus_convert_available && App.config.opus_convert.enable, "有効", "無効")}
${cyan}英語辞書変換${gray}:${reset} ${ans(App.status.remote_replace_available, "有効", "無効")}
${cyan}サーバー辞書単語数${gray}:${reset} ${App.dictionaries.length}
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
