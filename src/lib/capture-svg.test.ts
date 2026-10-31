import test from 'node:test'
import assert from 'node:assert/strict'
import { captureSvgSource, captureSvgBase64, captureSvgSize } from './capture-svg'
const prefix='data:image/svg+xml;charset=utf-8,'
test('SVG byte sizes collapse into a closed vocabulary, never content or filenames',()=>{
 assert.deepEqual([0,262144,1048576,4194304,16777216].map(captureSvgSize),['under_256k','256k_1m','1m_4m','4m_16m','16m_plus'])
})
test('XML-invalid pasted controls are removed only from the serialized export',()=>{
 const text='原始\u0000\u0001\u000b\u000c\u001f内容\ufffe\uffff\t\r\n😀𠀀'
 const source=prefix+encodeURIComponent('<svg>'+text+'</svg>')
 assert.equal(decodeURIComponent(captureSvgSource(source).slice(prefix.length)),'<svg>原始内容\t\r\n😀𠀀</svg>')
 assert.ok(text.includes('\u0001'))
})
test('valid CJK, emoji, XML escapes, images and transport bytes are preserved',()=>{
 const xml='<svg>你好 &amp; &lt; 😀❤️👨‍👩‍👧‍👦\n\t<data>data:image/png;base64,aGVsbG8=</data></svg>'
 const source=prefix+encodeURIComponent(xml)
 assert.equal(captureSvgSource(source),source)
 assert.equal(Buffer.from(captureSvgBase64(source).split(',')[1],'base64').toString('utf8'),xml)
 assert.equal(captureSvgSource('data:image/png;base64,aGVsbG8='),'data:image/png;base64,aGVsbG8=')
})
