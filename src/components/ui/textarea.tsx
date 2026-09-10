import * as React from "react"
import { cn } from "@/lib/utils"
import './foundation.css'

const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          'ui-textarea',
          className
        )}
        ref={ref}
        data-slot="textarea"
        {...props}
      />
    )
  }
)
Textarea.displayName = "Textarea"

export { Textarea }
