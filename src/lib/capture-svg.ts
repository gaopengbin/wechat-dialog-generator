// XML 1.0 disallows these invisible characters even though HTML text nodes
// accept them (for example, when pasted from another app). Clean the export
// serialization only; never mutate the editor, saved messages or valid emoji.
export function captureSvgSource(source: string) {
  const prefix = 'data:image/svg+xml;charset=utf-8,'
  if (!source.startsWith(prefix)) return source
  const xml = decodeURIComponent(source.slice(prefix.length))
  // eslint-disable-next-line no-control-regex -- these are XML-invalid code points
  const clean = xml.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffe\uffff]/g, '')
  return clean === xml ? source : prefix + encodeURIComponent(clean)
}

// A second transport for engines that reject an otherwise valid percent-
// encoded SVG. Keep data: (not blob:) so foreignObject remains canvas-safe.
export function captureSvgBase64(source: string) {
  const prefix = 'data:image/svg+xml;charset=utf-8,'
  if (!source.startsWith(prefix)) return source
  const bytes = new TextEncoder().encode(decodeURIComponent(source.slice(prefix.length)))
  let binary = ''
  for (let offset = 0; offset < bytes.length; offset += 8192) binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192))
  return 'data:image/svg+xml;base64,' + btoa(binary)
}

export type SvgCleanup = 'none' | 'comments' | 'attributes' | 'mixed'
const XML_NS='http://www.w3.org/XML/1998/namespace'
const XLINK_NS='http://www.w3.org/1999/xlink'

// This receives only html-to-image's detached, styled export clone. Never
// remove React anchors or extension attributes from the live editor DOM.
export function sanitizeCaptureClone(root: Node): SvgCleanup {
  let comments=false,attributes=false
  const namespace=(element: Element,prefix: string): string | null => {
    if(prefix==='xml')return XML_NS
    if(prefix==='xlink')return XLINK_NS
    for(let node: Element|null=element;node;node=node.parentElement){
      const uri=node.getAttribute(`xmlns:${prefix}`)
      if(uri)return uri
    }
    return element.lookupNamespaceURI(prefix)
  }
  const visit=(node: Node) => {
    // SVG subtrees are deep-cloned by the library, bypassing its filter.
    // Walking the completed clone also removes illegal comments inside icons.
    for(const child of Array.from(node.childNodes)){
      if(child.nodeType===8 || child.nodeType===7){node.removeChild(child);comments=true}
      else visit(child)
    }
    if(node.nodeType!==1)return
    const element=node as Element
    for(const attribute of Array.from(element.attributes)){
      if(!attribute.name.includes(':') || attribute.namespaceURI || attribute.name.startsWith('xmlns:'))continue
      const prefix=attribute.name.slice(0,attribute.name.indexOf(':'))
      const uri=namespace(element,prefix)
      element.removeAttribute(attribute.name);attributes=true
      // Keep real xml:/xlink:/declared namespaces; omit only unbound metadata.
      if(uri)element.setAttributeNS(uri,attribute.name,attribute.value)
    }
  }
  visit(root)
  return comments&&attributes?'mixed':comments?'comments':attributes?'attributes':'none'
}

export function captureSvgSize(bytes: number) {
  return bytes<262144?'under_256k':bytes<1048576?'256k_1m':bytes<4194304?'1m_4m':bytes<16777216?'4m_16m':'16m_plus'
}

export function validateCaptureSvg(source: string,cleanup: SvgCleanup) {
  const xml=decodeURIComponent(source.slice(source.indexOf(',')+1))
  const parsed=new DOMParser().parseFromString(xml,'image/svg+xml')
  const valid=parsed.documentElement.localName==='svg' && parsed.documentElement.namespaceURI==='http://www.w3.org/2000/svg' && !parsed.querySelector('parsererror')
  const diagnostics={svg_xml:valid?'valid':'invalid',svg_size:captureSvgSize(new TextEncoder().encode(xml).byteLength),svg_cleanup:cleanup}
  if(!valid)throw Object.assign(new Error('导出结构校验失败，请刷新页面后重试；本次未扣额度。'),{exportReason:'render_failed',renderStep:'svg_rasterize',captureInfo:{failure_code:'svg_invalid',...diagnostics}})
  return diagnostics
}
