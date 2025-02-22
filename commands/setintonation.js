const { ApplicationCommandOptionType } = require('discord.js');

module.exports = {
    data: {
      name: "setintonation",
      description: "声のイントネーションを設定します。(デフォルト: 100)",
      options: [
        {
          type: ApplicationCommandOptionType.Integer,
          name: "intonation",
          description: "これね、ずんだって言うんだってぇハ↓カセに教えてもらったンの！",
          required: true,
          min_value: 0,
          max_value: 200,
        }
      ]
    },
}
