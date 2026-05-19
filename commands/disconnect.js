const { getVoiceConnection } = require("@discordjs/voice");
module.exports = {
  data: {
    name: "disconnect",
    description: "ボイスチャンネルにさよなら。"
  },
  async execute(interaction) {
    const guild = interaction.guild;
    
    const connection = getVoiceConnection(guild.id);
    if (connection != null){
        global.vcPauseMap.set(guild, true);
        connection.destroy();
        await interaction.reply({ content: '切断しました。' });
    }
    else{
      await interaction.reply({ content: 'ボイスチャンネルの接続がありません。' })
    }
    
  },
}
