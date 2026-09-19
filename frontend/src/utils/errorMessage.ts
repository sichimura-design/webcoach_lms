/**
 * エラーを画面に出すときのメッセージを決める。
 *
 * 例外の message（"Request failed with status code 404" 等の英語スタックメッセージや
 * ネットワークエラーの内部文言）をそのまま画面に出すと、受講生には何が起きたか
 * 伝わらないうえに実装の内部情報を晒してしまう。画面に出してよいのは、
 *  1. こちらのAPIがユーザー向けに意図して返した message/detail
 *  2. 通信を伴わない、呼び出し側が自前で投げたバリデーション用の Error
 *     （CSV行チェックなど。message 自体が日本語でユーザー向けに書かれている）
 * のどちらかだけで、それ以外（axios/fetch由来の通信エラー全般）は
 * 呼び出し側が用意した日本語のフォールバックにする。
 */
export function getUserMessage(err: unknown, fallback: string): string {
  const anyErr = err as {
    response?: { data?: { message?: unknown; detail?: unknown } };
    request?: unknown;
    isAxiosError?: boolean;
  };

  const backendMessage = anyErr?.response?.data?.message ?? anyErr?.response?.data?.detail;
  if (typeof backendMessage === 'string' && backendMessage.trim()) {
    return backendMessage;
  }

  const isHttpError = !!(anyErr?.isAxiosError || anyErr?.response || anyErr?.request);
  if (!isHttpError && err instanceof Error && err.message) {
    return err.message;
  }

  return fallback;
}
