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
                    name: 'まずは自動接続を設定します。',
                    value:`/auto`
                },
                {
                    name:'ボイスチャット通知を有効にしたい場合は送信チャンネルを設定してください。',
                    value:`/setnotifychannel`
                },
                {
                    name:'もし間違えて設定した場合ではこちらのコマンドで無効にできます。',
                    value:`/resetnotifychannel`
                },
                {
                    name:'autoでは読み上げチャンネルが自動的に設定されます。変更する場合ではこのコマンドを使います。',
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