// Cognito Custom Message trigger.
// Overrides the invitation (AdminCreateUser) and forgot-password emails with WEBCOACH's
// own copy, since Cognito's built-in templates only support {username}/{####} and this
// copy needs the user's actual email address embedded in the body.

const LOGIN_URL = process.env.LOGIN_URL;
const CONTACT_URL = process.env.CONTACT_URL;

exports.handler = async (event) => {
  const email = event.request.userAttributes.email;

  // CustomMessage_ResendCode fires when AdminCreateUser is re-invoked with
  // MessageAction=RESEND (e.g. re-sending the temp password to an unconfirmed
  // user) — it must be handled the same as the initial invite, or Cognito
  // silently falls back to its bare English default template.
  if (event.triggerSource === 'CustomMessage_AdminCreateUser' || event.triggerSource === 'CustomMessage_ResendCode') {
    event.response.emailSubject = '【WEBCOACH】アカウント発行のお知らせ（初回ログインのご案内）';
    event.response.emailMessage = [
      'WEBCOACHの学習コンテンツをご利用いただくためのアカウントが発行されました',
      '下記の情報で初回ログインを行ってください。',
      '',
      `■ ログインURL：${LOGIN_URL}`,
      `■ メールアドレス：${email}`,
      `■ 仮パスワード：${event.request.codeParameter}`,
      '',
      '初回ログイン時に、新しいパスワードの設定をお願いします。',
      '',
      '※仮パスワードは発行から1週間以内にご使用ください。',
      '1週間を過ぎると使用できなくなります。その場合はお手数ですが、下記の【お問い合わせ先】までご連絡ください。',
      '',
      '────────────────────────────',
      'WEBCOACHでは、メール等でパスワードをお尋ねすることは一切ありません。',
      'このメールにお心当たりがない場合は、恐れ入りますが以下のお問い合わせ先までご連絡ください。',
      '',
      '【お問い合わせ先】',
      CONTACT_URL,
      // Cognito requires {username} in the invite body; without it the whole body
      // silently falls back to the English default (only the subject is kept).
      // It is not meant to be shown to users, so it is hidden in an HTML comment.
      `<!-- ${event.request.usernameParameter} -->`,
    ].join('<br>');
  } else if (event.triggerSource === 'CustomMessage_ForgotPassword') {
    event.response.emailSubject = '【WEBCOACH】アカウントパスワード再設定のお手続き';
    event.response.emailMessage = [
      'WEBCOACHの学習コンテンツについて、パスワード再設定のリクエストを受け付けました。',
      '下記の認証コードを画面に入力し、新しいパスワードを設定してください。',
      '',
      `認証コード：${event.request.codeParameter}`,
      '',
      '有効期限を過ぎると、このコードは使用できなくなります。',
      'その場合は、お手数ですが、もう一度パスワード再設定をお試しください。',
      '',
      '────────────────────────────',
      'このメールにお心当たりのない場合はそのまま削除してください。',
      '認証コードは絶対に第三者に教えないでください。WEBCOACHからコードをお尋ねすることはありません。',
      'ご不明な点は以下のお問い合わせ先までご連絡ください。',
      '',
      '【お問い合わせ先】',
      CONTACT_URL,
    ].join('<br>');
  }

  return event;
};
