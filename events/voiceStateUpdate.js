// MIT License 2024 RuriSapphire

// ボイスチャット検知のeventです。自動接続のeventはindex.jsにあります。

// 流れ: voiceStateUpdate > ユーザー数判断 > 時間カウント開始・終了 > メッセージ送信

const {ChannelType, PermissionFlagsBits} = require('discord.js');

const log4js = require('log4js');
const BotUtils = require('../src/bot_utils.js');

let logger = log4js.getLogger();
const bot_utils = new BotUtils(logger);

module.exports={
    name: 'voiceStateUpdate',
    timeMessage(dTime, dAction, stat){
        serverFile = bot_utils.get_server_file(stat.guild.id);
        if (serverFile.notify === false) return;
        global.channelMap.set(stat.guild.id, serverFile.text);
        let Lchannel = global.channelMap.get(stat.guild.id);
        if (!Lchannel){
            Lchannel = stat.guild.channels.cache.find(ch => ch.type === ChannelType.GuildText && ch.permissionsFor(stat.guild.members.me).has(PermissionFlagsBits.SendMessages)).id;
        }
        if (dAction === 'start'){
            const Msg ={
                title: 'ボイスチャットが始まりました',
                fields: [
                    {
                        name:'チャンネル',
                        value: stat.channel.toString(),
                    },
                    {
                        name:'ユーザー',
                        value: stat.member.displayName,
                    },
                    {
                        name: '現在時間',
                        value: dTime.toTimeString(),
                    }
                ]
            }
            stat.client.channels.cache.get(Lchannel).send({embeds:[Msg]});
        }
        if (dAction === 'end'){
            let timeS = parseInt((dTime/1000)%60);
            let timeMin = parseInt((dTime/60000)%60);
            let timeHr = parseInt((dTime/3600000)%60);
            let curTimeMsg = timeHr + ' hours ' + timeMin + ' mins ' + timeS + ' s\n';
            const Msg ={
                title: 'ボイスチャットが終わりました',
                fields: [
                    {
                        name:'チャンネル',
                        value: stat.channel.toString(),
                    },
                    {
                        name: '経過時間',
                        value: curTimeMsg,
                    }
                ]
            }
            stat.client.channels.cache.get(Lchannel).send({embeds:[Msg]});
        }
    },
    countStart(startChannel){
        //console.log('Someone in ' + startChannel.guild.toString() + ' started a voice chat');
        const vcStatus = {
            channel: startChannel.channelId,
            startTime: new Date(),
        }
        global.vcTimeMap.set(startChannel.channelId, vcStatus);
        if (global.vcServerMap.get(startChannel.guildId) == null|| Date.now() - global.vcServerMap.get(startChannel.guildId)>6000){
            this.timeMessage(vcStatus.startTime, 'start', startChannel);
            global.vcServerMap.set(startChannel.guildId, Date.now());
        }
        else global.vcServerMap.set(startChannel.guildId, Date.now());
    },
    countEnd(endChannel){
        //console.log('The voice chat in ' + endChannel.guild.toString() + ' ended');
        let endTime = new Date();
        if (global.vcTimeMap.get(endChannel.channelId)== undefined)return;
        let timeDiff = endTime - global.vcTimeMap.get(endChannel.channelId).startTime;
        // スパム防止のため時間を記録し、短すぎるときに通知を行わなくなります（countStartにもあります）(ms)
        if (global.vcServerMap.get(endChannel.guildId) == null || Date.now() - global.vcServerMap.get(endChannel.guildId)>6000){
            this.timeMessage(timeDiff, 'end', endChannel);
            global.vcServerMap.set(endChannel.guildId, null);
        }
        else global.vcServerMap.set(endChannel.guildId, Date.now());
        //console.log(Date.now() - global.vcServerMap.get(endChannel.guildId));
        global.vcTimeMap.set(endChannel.channelId, null);
    },
    async execute(endChannel, startChannel){
        if(!startChannel && !endChannel){
            console.log('Voice Channels Unreachable');
            return;
        }
        if (endChannel.channel!=null && startChannel.channel==null){
            if (bot_utils.get_server_file(endChannel.guild.id).autojoin===false) return;
            //console.log('Exited');
            if(endChannel.channel.members.size==0){
                this.countEnd(endChannel);
                return;
            }
            return;
        }
        else if (startChannel.channel!=null && endChannel.channel==null){
            //console.log('Joined');
            if (bot_utils.get_server_file(startChannel.guild.id).autojoin===false) return;
            if(startChannel.channel.members.size==1){
                this.countStart(startChannel);
                return;
            }
            return;
        }
        else if (startChannel.channel!=null && endChannel.channel!=null){
            //console.log('Moved');
            if (bot_utils.get_server_file(endChannel.guild.id).autojoin===false || bot_utils.get_server_file(endChannel.guild.id).text===null) return;
            if(endChannel.channel.members.size<=1){
                this.countEnd(endChannel);
            }
            if(startChannel.channel.members.size===1){
                this.countStart(startChannel);
            }
            return;
        }
        console.log('No action taken.');
    }
}
