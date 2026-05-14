const { ApplicationCommandOptionType } = require('discord.js');

module.exports = {
  data: {
    name: "copyvoicesay",
    description: "他人のボイス設定を使って読み上げる",
    options: [
      {
        type: ApplicationCommandOptionType.User,
        name: "user",
        description: "ユーザー",
        required: true
      },
      {
        type: ApplicationCommandOptionType.String,
        name: "text",
        description: "内容",
        required: true,
        min_length: 1
      }
    ]
  },
  async execute(interaction, vc_process){
    const guild_id = interaction.guild.id;

    const connection = global.connections_map.get(guild_id);

    if(!connection){
      await interaction.reply({ content: "接続がありません。" });
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

    vc_process.add_text_queue.bind(vc_process)(msg_obj, true);

    await interaction.reply({ content: "まかせてください！" });
  }
}
