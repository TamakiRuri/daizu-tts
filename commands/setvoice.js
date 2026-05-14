// MIT License 2026 RuriSapphire

const log4js = require('log4js');
const BotUtils = require('../src/bot_utils.js');

let logger = log4js.getLogger();
const bot_utils = new BotUtils(logger);

const { EmbedBuilder, StringSelectMenuBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

let choicePages = [];
let infoPages = [];

module.exports = {
    data: {
        name: "setvoice",
        description: "ボイスを変更します。"
    },
    buildDropdown(page, choices){
        return new StringSelectMenuBuilder()
        .setCustomId(`voice_menu_${page}`)
        .setPlaceholder(`話者を選択してください`)
        .addOptions(choices);
    },
    buildEmbed(page, content){
        const res = [{
            title: `ページ ${page + 1}`,
            description: content
        }]
        return res;
    },
    buildButtons(next, pageIndex){
        return button = new ButtonBuilder()
        .setCustomId(next ? `next_${pageIndex}`: `prev_${pageIndex}`)
        .setLabel(next ? "次のページ": "前のページ")
        .setStyle(next ? ButtonStyle.Primary : ButtonStyle.Secondary)
    },
    buildButtonComponent(start, end, pageIndex){
        const value = Number(start) + Number(end)*2;
        const buttons = new ActionRowBuilder();
        switch(value){
            case 0:
                buttons.addComponents(this.buildButtons(false), pageIndex);
                buttons.addComponents(this.buildButtons(true), pageIndex);
                return buttons;
            case 1:
                buttons.addComponents(this.buildButtons(true), 0);
                return buttons;
            case 2:
                buttons.addComponents(this.buildButtons(false), pageIndex);
                return buttons;
            default:
                console.error("Set Voice Button Builder: value not accepted: " + value);
                return;
        }
    },
    async execute(interaction){
        for(let i =0; i < Math.ceil(global.voice_list.length / 25); i++ ){
            for(let j = i * 25; j < 25 *(i+1) ; j++){
                if (j == global.voice_list.length) break;
                const choiceObject ={
                    label: global.voice_list[j].toString(),
                    value: j
                }
                choicePages[i].push(choiceObject);
            }
            infoPages[i].push(global.voice_list.slice( 25 *i, 25 * (i+1)).join("/n"));
        }
        await interaction.reply({
            embeds: this.buildEmbed(0, infoPages[0]),
            components: [
                new ActionRowBuilder().addComponents(this.buildDropdown(0, choicePages[0])),
                this.buildButtonComponent(true, false, 0)
            ]
        })
    },
    async updateMenu(interaction){
        const [action, page] = interaction.customId.split("_");
        const pageIndex = parseInt(page);
        if(action === "next"){
            pageIndex++;
        }
        else if (action === "prev"){
            pageIndex--;
        }
        else{
            console.error("Update Menu: ID not accepted: " + customId);
            return;
        }
        await interaction.update({
            embeds: this.buildEmbed(pageIndex, infoPages[pageIndex]),
            components:[
                new ActionRowBuilder().addComponents(this.buildDropdown(pageIndex, choicePages[pageIndex])),
                new ActionRowBuilder().addComponents(this.buildButtonComponent(pageIndex === 0, pageIndex === Math.ceil(global.voice_list.length / 25) - 1, pageIndex))
            ]
        })
    }
}