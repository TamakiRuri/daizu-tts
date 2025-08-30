// MIT License 2025 RuriSapphire
const log4js = require('log4js');
const BotUtils = require('../src/bot_utils.js');

let logger = log4js.getLogger();
const bot_utils = new BotUtils(logger);


module.exports = {
    data:{
        name: 'resetnotifychannel',
        description: '入室通知を無効にする',
    },
    async execute(interaction){
        global.channelMap.set(interaction.guildId, "");
        const serverFile = bot_utils.get_server_file(interaction.guildId);
        bot_utils.write_serverinfo(interaction.guildId, serverFile, {text : "", notify: false});
        //console.log('Command \' SetChannel \' used in Server '+ interaction.guild.toString() + ' ID :' + global.channelMap.get(interaction.guildId).channelId);
        await interaction.reply({content:'入室通知を無効に設定しました。'})
    }
}