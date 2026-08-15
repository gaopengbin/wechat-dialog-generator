import {
  ArrowUpRight,
  BookOpen,
  CheckCircle2,
  Download,
  Laptop,
  LayoutTemplate,
  LockKeyhole,
  MousePointerClick,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react';

const templates = [
  {
    id: 'daily-story',
    label: '日常剧情',
    title: '周末碰面',
    description: '适合生活记录、段子和短视频剧情。',
    content: `**【8月12日 上午10:20】**
**我**：周末有空吗？新开的展览看起来不错
**小林**：有空，周六下午怎么样
**我**：可以，我把地址发你
**小林**：[语音]4
**我**：那就两点在门口见`,
  },
  {
    id: 'team-chat',
    label: '多人群聊',
    title: '项目讨论',
    description: '适合产品原型、教学演示和团队场景。',
    content: `**【8月12日 下午14:00】**
**高鹏彬**：新版演示链接已经更新，大家帮忙看一下
**小周**：移动端我来检查
**小李**：我负责核对文案和数据
**高鹏彬**：[图片]
**小周**：首页在小屏幕上也正常
**小李**：数据更新时间已经补上了
**高鹏彬**：收到，晚点统一发布`,
  },
  {
    id: 'creator-script',
    label: '创作脚本',
    title: '反转对话',
    description: '快速搭建短视频分镜和故事对白。',
    content: `**【8月12日 晚上20:31】**
**阿哲**：你到楼下了吗
**我**：到了，但是没看到你
**阿哲**：我穿着蓝色外套
**我**：这里有三个人都穿蓝色外套
**阿哲**：那你看谁手里拿着蛋糕
**我**：原来今天是给我过生日？`,
  },
];

interface GrowthContentProps {
  onUseTemplate: (content: string, templateId: string) => void;
}

export function GrowthContent({ onUseTemplate }: GrowthContentProps) {
  return (
    <section className="growth-content" aria-label="微信聊天截图制作指南">
      <div className="growth-section" id="templates">
        <div className="growth-heading">
          <div>
            <span className="growth-eyebrow"><LayoutTemplate size={14} /> 对话模板</span>
            <h2>从一个好用的示例开始</h2>
            <p>选择模板后仍可自由修改人物、消息、头像和手机状态。</p>
          </div>
          <a className="text-link" href="#editor">自己输入内容 <ArrowUpRight size={15} /></a>
        </div>
        <div className="template-grid">
          {templates.map((template) => (
            <article className="template-card" key={template.id}>
              <span>{template.label}</span>
              <h3>{template.title}</h3>
              <p>{template.description}</p>
              <button onClick={() => onUseTemplate(template.content, template.id)}>
                使用这个模板 <MousePointerClick size={15} />
              </button>
            </article>
          ))}
        </div>
      </div>

      <div className="growth-section guide-section" id="guide">
        <div className="growth-heading">
          <div>
            <span className="growth-eyebrow"><BookOpen size={14} /> 使用教程</span>
            <h2>三步生成清晰的微信聊天截图</h2>
            <p>无需注册即可开始制作，游客每日可免费导出 10 次，整个制作过程都在当前浏览器中完成。</p>
          </div>
        </div>
        <ol className="guide-grid">
          <li><b>01</b><div><h3>粘贴或选择模板</h3><p>支持文字、图片、语音、红包、转账与时间节点。</p></div></li>
          <li><b>02</b><div><h3>调整人物和界面</h3><p>设置头像、聊天标题、气泡颜色、时间和电量。</p></div></li>
          <li><b>03</b><div><h3>导出图片</h3><p>下载普通截图、完整长截图，或者直接复制到剪贴板。</p></div></li>
        </ol>
      </div>

      <div className="growth-section trust-section">
        <div className="trust-copy">
          <span className="growth-eyebrow"><ShieldCheck size={14} /> 干净、私密、无干扰</span>
          <h2>聊天内容不需要离开你的设备</h2>
          <p>对话解析、头像处理和图片生成均在浏览器本地完成。游客无需登录即可使用，每日可免费导出 10 次；聊天内容和生成图片不会上传。</p>
          <div className="trust-list">
            <span><LockKeyhole size={16} /> 本地处理</span>
            <span><Laptop size={16} /> 无需安装</span>
            <span><CheckCircle2 size={16} /> 无弹窗广告</span>
          </div>
        </div>
        <div className="trust-signal" aria-hidden="true">
          <Sparkles size={22} />
          <strong>LOCAL</strong>
          <span>只在浏览器中生成</span>
        </div>
      </div>

      <div className="growth-section faq-section" id="faq">
        <div className="growth-heading">
          <div>
            <span className="growth-eyebrow"><Users size={14} /> 常见问题</span>
            <h2>关于在线微信对话生成器</h2>
          </div>
        </div>
        <div className="faq-grid">
          <details><summary>需要下载软件或注册账号吗？</summary><p>不需要下载软件或强制注册。游客打开页面即可制作，每日可免费导出 10 次；登录后可保存账户额度并领取公众号奖励。</p></details>
          <details><summary>聊天内容和头像会上传吗？</summary><p>不会。内容解析、头像预览和截图生成均在浏览器本地完成，站点只记录匿名访问、创建和导出事件。</p></details>
          <details><summary>可以生成多人群聊和长截图吗？</summary><p>可以。导入三位及以上参与者会自动形成群聊标题，也可以导出包含完整对话的长截图。</p></details>
          <details><summary>生成的图片适合哪些场景？</summary><p>适合内容创作、产品原型、教学演示和剧情分镜。请明确标注模拟内容，避免用于误导、冒充或欺诈。</p></details>
        </div>
      </div>

      <div className="growth-footer">
        <span><Download size={15} /> 每日免费 10 次 · 无弹窗广告</span>
        <span>本工具与微信官方无关联，仅用于合法的创作、教学和设计演示。</span>
      </div>
    </section>
  );
}
