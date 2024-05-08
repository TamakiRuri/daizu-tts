// MIT License 2024 RuriSapphire
module.exports={
    data:{
        name: 'start',
        description:'初めて利用するためのチュートリアル',
    },
    async execute(interaction){
        const msg = {
            title: 'daizu-ttsはvoicevoxを利用するシンプルな読み上げボットです',
            fields:[
                {
                    name: 'まずは自動接続を設定します。設定するとボイスチャット検知も有効になります。',
                    value:`/auto`
                },
                {
                    name:'ボイスチャット検知の送信チャンネルを設定すると便利です。',
                    value:`/setchannel`
                },
                {
                    name:'もし読み上げるチャンネルを設定したい場合ではこのコマンドを使います。設定しない場合はボイスチャンネル付属のテキストチャンネルを読み上げます。',
                    value:`/settextchannel`
                },
                {
                    name:'手動で接続/切断するコマンドです。',
                    value:'`/connect` `/disconnect`'
                },
                {
                    name:'ユーザー辞書を追加すると読み上げの精度が良くなります。',
                    value:`/dicadd`
                },
                {
                    name:'コマンドの詳しい情報です。',
                    value:`/help`
                }
            ]
        }
        await interaction.reply({embeds:[msg]});
    }
}