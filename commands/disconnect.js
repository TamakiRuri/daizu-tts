const { getVoiceConnection } = require("@discordjs/voice");
module.exports = {
  data: {
    name: "disconnect",
    description: "ボイスチャンネルにさよなら。"
  },
  async execute(interaction) {
    const guild = interaction.guild;
    global.vcPauseMap.set(guild.id, true);
    // console.log(global.vcPauseMap);
    const connection = getVoiceConnection(guild.id);
    if (connection != null){
        connection.destroy();
        await interaction.reply({ content: '切断しました。' });
    }
    else{
      await interaction.reply({ content: 'ボイスチャンネルの接続がありません。' })
    }
    
  },
}
