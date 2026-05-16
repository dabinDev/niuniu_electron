export function LoadingState({ title = "正在加载数据" }: { title?: string }) {
  return (
    <div className="state-block">
      <span className="loader-ring" />
      <b>{title}</b>
      <p>正在连接本地行情服务，稍等片刻。</p>
    </div>
  );
}
