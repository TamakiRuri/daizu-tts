const {ApplicationCommandOptionType } = require('discord.js');
const log4js = require('log4js');
const BotUtils = require('../src/bot_utils.js');

let logger = log4js.getLogger();
const bot_utils = new BotUtils(logger);

module.exports = {
  data: {
    name: "dicdel",
    description: "辞書から消す。",
    options: [
      {
        type: ApplicationCommandOptionType.String,
        name: "target",
        description: "この世から消したい単語。",
        required: true,
        min_length: 1
      },
    ]
  },
  async execute(interaction){
    const guild_id = interaction.guild.id;

    const connection = global.connections_map.get(guild_id);

    const server_file = bot_utils.get_server_file(guild_id);
    let dict = server_file.dict;

    const target = interaction.options.get("target").value;

    let exist = false;

    for(let d of dict){
      if(d[0] === target){
        exist = true;
        break;
      }
    }

    if(!exist){
      await interaction.reply({ content: "ないよ" });
      return;
    }

    dict = dict.filter(word => word[0] !== target);

    bot_utils.write_serverinfo(guild_id, server_file, { dict: dict });

    if(connection) connection.dict = dict;

    await interaction.reply({ content: "削除しました。" });
  }

}


