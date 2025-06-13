// MIT License 2024 RuriSapphire
const log4js = require('log4js');
const BotUtils = require('../src/bot_utils.js');

let logger = log4js.getLogger();
const bot_utils = new BotUtils(logger);

module.exports = {
    data:{
        name: 'setnotifychannel',
        description: 'ボイチャの通知チャンネルをここに設定する',
    },
    async execute(interaction){
        global.channelMap.set(interaction.guildId, interaction.channelId);
        const serverFile = bot_utils.get_server_file(interaction.guildId);
        bot_utils.write_serverinfo(interaction.guildId, serverFile, {text : interaction.channel.id,notify : true});
        //console.log('Command \' SetChannel \' used in Server '+ interaction.guild.toString() + ' ID :' + serverFile.text);
        await interaction.reply({content:'通知チャンネルを'+interaction.channel.toString()+'に設定しました。'})
    }
}