const {credit_replaces} = require("../credit_replaces.json");
const {EmbedBuilder} = require("discord.js");
module.exports = {
  data: {
    name: "credit",
    description: "このBotで利用可能な音声ライブラリのクレジット表記を生成します。"
  },
  async execute(interaction, voice_library_list){
    const voice_list_tmp = Array.from(voice_library_list)
      .map(val => {
        for(let r of credit_replaces) val = val.replace(r[0], r[1]);
        return val;
      })
      .map(val => `VOICEVOX:${val}`);

    const em = new EmbedBuilder()
      .setTitle(`利用可能な音声ライブラリのクレジット一覧です。`)
      .setDescription("詳しくは各音声ライブラリの利用規約をご覧ください。\nhttps://voicevox.hiroshiba.jp")
      .addFields(
        { name: "一覧", value: `${voice_list_tmp.join("\n")}`},
      );

    await interaction.reply({ embeds: [em] });
  }
}
