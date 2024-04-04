const {EmbedBuilder, ApplicationCommandOptionType } = require('discord.js');
const log4js = require('log4js');
const BotUtils = require('../src/bot_utils.js');

let logger = log4js.getLogger();
const bot_utils = new BotUtils(logger);

const priority_list = [ "最弱", "よわい", "普通", "つよい", "最強" ];

module.exports = {
  data: {
    name: "diclist",
    description: "辞書の単語一覧。",
  },
  async execute(interaction){
    const server_file = bot_utils.get_server_file(interaction.guild.id);
    let dict = server_file.dict;

    let list = "";
    let is_limit = false;

    for(let p = 0; p < 5; p++){
      const tmp_dict = dict.filter(word => word[2] === p);

      if((list.length + `**${priority_list[p]}**\n`.length) > 1024){
        is_limit = true;
        break;
      }else{
        list += `**${priority_list[p]}**\n`;

        for(let d of tmp_dict){
          const s = `${d[0]} → ${d[1]}\n`;
          if((s.length + list.length) > 1024){
            is_limit = true;
            break;
          }else{
            list += s;
          }
        }
      }
    }

    const em = new EmbedBuilder()
      .setTitle(`登録されている辞書の一覧です。`)
      .addFields(
        { name: "一覧", value: `${list}`},
      );

    if(is_limit) em.setDescription("表示上限を超えているため省略されています。");

    await interaction.reply({ embeds: [em] });
  }
}
