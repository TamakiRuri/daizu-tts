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
}
