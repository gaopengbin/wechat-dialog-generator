import { Progress as Primitive } from '@base-ui/react/progress'
import { cn } from '@/lib/utils'
import './foundation.css'

export function Progress({ className, ...props }: Primitive.Root.Props) {
  return <Primitive.Root data-slot="progress" className={cn('ui-progress', className)} {...props}>
    <Primitive.Track className="ui-progress-track"><Primitive.Indicator className="ui-progress-indicator" /></Primitive.Track>
  </Primitive.Root>
}
