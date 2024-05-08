// MIT License 2024 RuriSapphire
//いまはボイス読み上げ専用のチャンネルを設定する

//目標: ボイスチャットとテキストチャンネルペアを設定する

const log4js = require('log4js');
const BotUtils = require('../src/bot_utils.js');

let logger = log4js.getLogger();
const bot_utils = new BotUtils(logger);

module.exports = {
    data:{
        name: 'settextchannel',
        description: 'サーバー全体の読み上げチャンネルを設定する',
    },
    async execute(interaction){
        const serverFile = bot_utils.get_server_file(interaction.guildId);
        bot_utils.write_serverinfo(interaction.guildId, serverFile, {textchannel:interaction.channel.id});
        let connection = global.connections_map.get(interaction.guildId);
        if (connection)connection.text = interaction.channelId;
        //console.log('Command \' SetChannel \' used in Server '+ interaction.guild.toString() + ' ID :' + global.channelMap.get(interaction.guildId).channelId);
        await interaction.reply({content:'読み上げるチャンネルを'+interaction.channel.toString()+'に設定しました。'})
    }
}