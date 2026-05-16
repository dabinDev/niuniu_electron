export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="state-block error">
      <b>数据暂时不可用</b>
      <p>{message}</p>
      {onRetry ? (
        <button className="ghost-button" onClick={onRetry} type="button">
          重新加载
        </button>
      ) : null}
    </div>
  );
}
