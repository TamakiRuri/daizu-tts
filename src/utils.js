const emoji_regex = require('emoji-regex');
const {
  TEXT_LENGTH_NORMAL,
  TEXT_LENGTH_MAX,
  PRONOUNCE_SPEED_MAX
} = require('../config.json');

module.exports = class Utils{
  static replace_url(text){
    return text.replace(/https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/gi, 'ゆーあーるえる省略');
  }
  // Botの声設定の値をVoiceboxの値に変換する
  static map_voice_setting(sample, out_min, out_max, in_min = 0, in_max = 200){
    return (sample - in_min) * (out_max - out_min) / (in_max - in_min) + out_min;
  }

  // テキストをBotで読ませてうざくないように調整する
  static get_text_and_speed(text){
    const count = text.length;
    let text_speed = 0;
    let text_after = text;

    // NORMAL文字以下、加速しない、変更しない
    if(count < TEXT_LENGTH_NORMAL) text_speed = 0;
    // NORMAL文字以上MAX文字以下、加速する、変更しない
    else if(count > TEXT_LENGTH_NORMAL && count < TEXT_LENGTH_MAX) text_speed = PRONOUNCE_SPEED_MAX;
    // 文字以上、加速する、変更する。
    else{
      text_speed = PRONOUNCE_SPEED_MAX;
      text_after = text.slice(0, TEXT_LENGTH_MAX) + "。いかしょうりゃく";
    }

    return { text: text_after, speed: text_speed };
  }

  static clean_message(text){
    let result = text;

    // カスタム絵文字
    result = result.replace(/<:([a-z0-9_-]+):[0-9]+>/gi, "$1");
    // 絵文字
    result = result.replace(emoji_regex(), "");
    // 記号
    result = result.replace(/["#'^\;:,|`{}<>]/g, "");
    // 改行
    result = result.replace(/\r?\n/g, "。")

    return result;
  }
}
