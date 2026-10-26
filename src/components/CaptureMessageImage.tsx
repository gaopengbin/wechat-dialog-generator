import { useLayoutEffect, useRef, useState } from 'react';
import { Button } from './ui/button';
import { assetScheme, loadPreviewResource } from '@/lib/capture-resources';

export function CaptureMessageImage({ source, number, onLocalize, onReplace, onError }: {
  source: string; number: number; onLocalize?: (data: string) => void; onReplace?: () => void; onError?: (error?: string) => void;
}) {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ source: string; data?: string; error?: string }>();
  const localize = useRef(onLocalize);
  const reportError = useRef(onError);
  useLayoutEffect(() => { localize.current = onLocalize; reportError.current = onError; }, [onLocalize, onError]);
  const remote = assetScheme(source, document.baseURI) === 'remote';
  useLayoutEffect(() => {
    if (!remote) return;
    let disposed = false;
    void loadPreviewResource(source, 'message', document.baseURI).then(data => {
      if (disposed) return;
      setResult({ source, data });
      reportError.current?.();
      localize.current?.(data);
    }, error => {
      if (!disposed) { const code = error?.captureInfo?.failure_code || 'asset_fetch'; setResult({ source, error: code }); reportError.current?.(code); }
    });
    return () => { disposed = true; };
  }, [source, remote, attempt]);
  const current = result?.source === source ? result : undefined;
  return <div data-message-number={number} data-capture-resource-error={remote ? current?.error : undefined}>
    <img src={current?.data || source} alt="" />
    {remote && !current && <span data-capture-ui className="wc-image-check" role="status">正在检查图片能否导出…</span>}
    {remote && current?.error && <div data-capture-ui className="wc-image-recovery" role="alert" onClick={event => event.stopPropagation()}>
      <span>这张外链图片未通过导出检查。请上传原图或重新检查；不会扣额度。</span>
      <div>{onReplace && <Button size="sm" variant="outline" onClick={onReplace}>上传原图</Button>}<Button size="sm" variant="outline" onClick={() => { setResult(undefined); setAttempt(value => value + 1); }}>重新检查图片</Button></div>
    </div>}
  </div>;
}
