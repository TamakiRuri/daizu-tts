const { ApplicationCommandOptionType } = require('discord.js');

module.exports = {
  data: {
    name: "setdefaultvoice",
    description: "ふっかつのじゅもんでデフォルトの声を一括設定します",
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
}
