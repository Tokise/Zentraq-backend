import { cn } from "@/lib/utils"

type SectionHeaderProps = {
  title: string
  description?: string
  children?: React.ReactNode
  className?: string
}

export function SectionHeader({
  title,
  description,
  children,
  className,
}: SectionHeaderProps) {
  return (
    <div className={cn("flex items-center justify-between", className)}>
      <div>
        <h2 className="text-xl font-medium tracking-tight">{title}</h2>
        {description && (
          <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {children}
    </div>
  )
}
