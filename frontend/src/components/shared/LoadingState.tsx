import Loading from './Loading';

interface LoadingStateProps {
  message?: string;
  /** 互換のために残している（輪の大きさは Loading の既定に揃えた） */
  size?: number;
  fullHeight?: boolean;
  containerized?: boolean;
}

/**
 * 旧来の読み込み表示（MUI の CircularProgress）を、共通の Loading に寄せたもの。
 * 🔴 新しく使うときは shared/Loading を直接使う。ここは既存の呼び出し側のために残している。
 */
function LoadingState({
  message = '読み込み中…',
  fullHeight = false,
  containerized = true,
}: LoadingStateProps) {
  const content = (
    <Loading variant="page" label={message} style={{ minHeight: fullHeight ? '100vh' : '50vh' }} />
  );

  if (containerized) {
    return <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 16px' }}>{content}</div>;
  }

  return content;
}

export default LoadingState;
