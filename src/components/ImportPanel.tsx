import { useRef, useState } from 'react';
import { FileUp, FileText, Trash2, Copy, Check, ChevronDown, ChevronUp } from 'lucide-react';
import { EXAMPLE_TEXT } from '@/lib/parser';

const DOUBAO_PROMPT = `请帮我生成一段微信群聊天记录，要求如下：
【参与人物】张伟、李娜、王芳（张伟是群主）
【聊天主题】讨论周末团建活动安排
【消息条数】15条左右
【时间跨度】某天下午

输出格式严格按照以下规则，不要输出任何其他内容：
1. 时间节点：**【X月X日 下午HH:MM】**
2. 消息格式：**姓名**：消息内容
3. 消息之间直接换行，不加序号或其他符号

示例格式：
**【3月15日 下午14:00】**
**张伟**：大家下周六有空吗，想组织个团建
**李娜**：有空的，去哪里？
**王芳**：我也可以，爬山怎么样
**张伟**：爬山不错，就定香山吧`;

interface ImportPanelProps {
  text: string;
  onTextChange: (text: string) => void;
  onImport: () => void;
}

export function ImportPanel({ text, onTextChange, onImport }: ImportPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [promptOpen, setPromptOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopyPrompt = async () => {
    await navigator.clipboard.writeText(DOUBAO_PROMPT);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleFileLoad = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      onTextChange(ev.target?.result as string);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="s-card">
      <div className="s-card-header">
        <h2><FileText size={20} /> 导入聊天记录</h2>
      </div>
      <div className="s-card-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="format-tip">
          <strong>支持的格式：</strong><br />
          Markdown 加粗：<code>**用户名**：消息内容</code><br />
          纯文本格式：<code>用户名: 消息内容</code><br />
          时间节点：<code>**【3月1日 14:32】**</code>
          <div className="tip-muted">标题行(#)、引用行(&gt;)、空行自动跳过。第一个出现的用户默认为"自己"。</div>
        </div>

        {/* 豆包Prompt区域 */}
        <div className="prompt-block">
          <button className="prompt-toggle" onClick={() => setPromptOpen(v => !v)}>
            <span>🤖 用豆包 / AI 生成聊天记录</span>
            {promptOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </button>
          {promptOpen && (
            <div className="prompt-body">
              <div className="prompt-desc">复制以下 Prompt 发给豆包，将返回内容粘贴到下方文本框即可：</div>
              <pre className="prompt-pre">{DOUBAO_PROMPT}</pre>
              <button className="btn btn-outline btn-sm" onClick={handleCopyPrompt}>
                {copied ? <><Check size={14} /> 已复制</> : <><Copy size={14} /> 复制 Prompt</>}
              </button>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <input ref={fileInputRef} type="file" accept=".md,.txt,.markdown" hidden onChange={handleFileLoad} />
          <button className="btn btn-outline btn-sm" onClick={() => fileInputRef.current?.click()}>
            <FileUp size={15} /> 导入文件
          </button>
          <button className="btn btn-outline btn-sm" onClick={() => onTextChange(EXAMPLE_TEXT)}>
            <FileText size={15} /> 加载示例
          </button>
        </div>

        <textarea
          className="s-textarea"
          value={text}
          onChange={(e) => onTextChange(e.target.value)}
          placeholder="在此粘贴聊天记录文本，或点击上方按钮导入文件..."
        />

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button className="btn btn-primary" onClick={onImport} disabled={!text.trim()}>
            解析并导入
          </button>
          <button className="btn btn-outline btn-sm" onClick={() => onTextChange('')} disabled={!text}>
            <Trash2 size={15} /> 清空
          </button>
        </div>
      </div>
    </div>
  );
}
