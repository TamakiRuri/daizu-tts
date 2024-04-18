// MIT License 2024 RuriSapphire
const log4js = require('log4js');
const BotUtils = require('../src/bot_utils.js');

let logger = log4js.getLogger();
const bot_utils = new BotUtils(logger);

module.exports = {
    data:{
        name: 'setchannel',
        description: 'ボイチャ検知の通知チャンネルをここに設定する',
    },
    async execute(interaction){
        global.channelMap.set(interaction.guildId, interaction.channelId);
        const serverFile = bot_utils.get_server_file(interaction.guildId);
        bot_utils.write_serverinfo(interaction.guildId, serverFile, {text:interaction.channelId});
        //console.log('Command \' SetChannel \' used in Server '+ interaction.guild.toString() + ' ID :' + global.channelMap.get(interaction.guildId).channelId);
        await interaction.reply({content:'通知チャンネルを'+interaction.channel.toString()+'に設定しました。'})
    }
}