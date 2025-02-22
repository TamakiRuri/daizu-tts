const { ApplicationCommandOptionType } = require('discord.js');

module.exports = {
    data: {
      name: "setpitch",
      description: "声のピッチを設定します。(デフォルト:100)",
      options: [
        {
          type: ApplicationCommandOptionType.Integer,
          name: "pitch",
          description: "ｺﾝﾆﾁﾊ!(超高音)(50億Hz)(家中の窓ガラスが割れる)",
          required: true,
          min_value: 0,
          max_value: 200,
        }
      ]
    },
}

