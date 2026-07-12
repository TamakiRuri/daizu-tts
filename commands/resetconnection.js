const { getVoiceConnection } = require("@discordjs/voice");
const log4js = require('log4js');
const BotUtils = require('../src/bot_utils.js');

let logger = log4js.getLogger();
const bot_utils = new BotUtils(logger);

module.exports = {
  data: {
    name: "resetconnection",
    description: "切断されてるのに切断されてない判定になった場合にご利用ください。"
  },
  async execute(interaction, vc_process){
    const guild_id = interaction.guild.id;

    const vc_con = getVoiceConnection(guild_id);
    if(vc_con) vc_con.destroy();

    const connection = global.connections_map.get(guild_id);
    if(connection) connection.audio_player.stop();
    global.connections_map.delete(guild_id);

    bot_utils.update_status_text(vc_process.client);

    interaction.reply({ content: "接続をリセットしました。" })
  }
}
