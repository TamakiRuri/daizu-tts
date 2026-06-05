// MIT License 2024 RuriSapphire
const log4js = require('log4js');
const BotUtils = require('../src/bot_utils.js');

let logger = log4js.getLogger();
const bot_utils = new BotUtils(logger);


module.exports = {
    data:{
        name: 'auto',
        description: '自動入室を有効/無効にする',
    },
    async execute(interaction){
        const serverFile = bot_utils.get_server_file(interaction.guildId);
        const result = serverFile.autojoin;
        const target = !result;
        if (target === true){
            bot_utils.write_serverinfo(interaction.guildId, serverFile, {autojoin : target, textchannel : interaction.channel.id});
            let connection = global.connections_map.get(interaction.guildId);
            if (connection)connection.text = interaction.channel.id;
        }
        else{
            bot_utils.write_serverinfo(interaction.guildId, serverFile, {autojoin : target});
        }
        logger.debug('Command \' auto \' used in Server '+ interaction.guild.toString() + ' ID :' + global.channelMap.get(interaction.guildId));
        const msg = '自動入室が'+ ((target) ? '有効': '無効') +'になりました。' + ((target)? '読み上げのチャンネルを現在のチャンネルに設定しました。':' ');
        await interaction.reply({content:msg})
    }
}