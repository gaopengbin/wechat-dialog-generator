import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react'

interface ScenePreviewFrameProps {
  captureRef: RefObject<HTMLDivElement | null>
  children: ReactNode
}

/** The screen remains 390px wide for export; only its surrounding preview is scaled. */
export function ScenePreviewFrame({ captureRef, children }: ScenePreviewFrameProps) {
  const frameRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ width: 300, height: 804 })

  useEffect(() => {
    const frame = frameRef.current
    const screen = captureRef.current
    if (!frame || !screen) return
    const observer = new ResizeObserver(() => {
      const width = frame.clientWidth
      const height = screen.offsetHeight
      // Hidden tool pages keep their last useful measurement until opened again.
      if (width < 1 || height < 1) return
      setSize(previous => previous.width === width && previous.height === height ? previous : { width, height })
    })
    observer.observe(frame)
    observer.observe(screen)
    return () => observer.disconnect()
  }, [captureRef])

  const scale = size.width / 390
  return <div className="scene-workspace-preview-frame" ref={frameRef} style={{ height: size.height * scale }}>
    <div className="scene-workspace-preview-zoom" style={{ transform: `scale(${scale})` }}>
      <div className="scene-workspace-preview" ref={captureRef}>{children}</div>
    </div>
  </div>
}
