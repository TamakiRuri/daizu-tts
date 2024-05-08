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
        bot_utils.write_serverinfo(interaction.guildId, serverFile, {autojoin : !result});
        //console.log('Command \' SetChannel \' used in Server '+ interaction.guild.toString() + ' ID :' + global.channelMap.get(interaction.guildId).channelId);
        await interaction.reply({content:'自動入室を'+ ((!serverFile.autojoin) ? '有効': '無効') +'に設定しました。'})
    }
}