import { Button } from './ui/button';
import { Download } from 'lucide-react';

export function CopyDownloadRecovery({ onDownload }: { onDownload: () => void }) {
  return <div className="copy-download-recovery" role="status">
    <p>浏览器未允许复制，已自动改为下载。若下载被拦截，可再次下载这张图片，无需重新生成、不重复扣额。</p>
    <Button variant="outline" onClick={onDownload}><Download size={15} />再次下载这张图片</Button>
  </div>;
}
