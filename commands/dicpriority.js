const {EmbedBuilder, ApplicationCommandOptionType } = require('discord.js');
const log4js = require('log4js');
const BotUtils = require('../src/bot_utils.js');

let logger = log4js.getLogger();
const bot_utils = new BotUtils(logger);

const priority_list = [ "最弱", "よわい", "普通", "つよい", "最強" ];

module.exports = {
  data: {
    name: "dicpriority",
    description: "辞書の優先度。",
    options: [
      {
        type: ApplicationCommandOptionType.String,
        name: "target",
        description: "優先度の設定をする単語",
        required: true,
        min_length: 1
      },
      {
        type: ApplicationCommandOptionType.Integer,
        name: "priority",
        description: "優先度",
        required: true,
        choices: [
          {
            name: "最強(一番上書きする)",
            value: 4
          },
          {
            name: "つよい",
            value: 3
          },
          {
            name: "普通(でふぉると)",
            value: 2
          },
          {
            name: "よわい",
            value: 1
          },
          {
            name: "最弱(すべてに上書きされる)",
            value: 0
          }
        ]
      }
    ]
  },
  async execute(interaction){
    const guild_id = interaction.guild.id;

    const connection = global.connections_map.get(guild_id);

    const server_file = bot_utils.get_server_file(guild_id);
    let dict = server_file.dict;

    const target = interaction.options.get("target").value;
    const priority = interaction.options.get("priority").value;

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

    dict = dict.map(val => {
      let result = val;
      if(val[0] === target) result[2] = priority;

      return result;
    });

    bot_utils.write_serverinfo(guild_id, server_file, { dict: dict });

    if(connection) connection.dict = dict;

    const em = new EmbedBuilder()
      .setTitle(`設定しました。`)
      .addFields(
        { name: "単語", value: `${target}`},
        { name: "優先度", value: `${priority_list[priority]}`},
      );

    await interaction.reply({ embeds: [em] });
  }
}

