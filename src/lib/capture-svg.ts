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
