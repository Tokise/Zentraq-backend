import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"

type PaginationProps = {
    currentPage: number
    totalPages: number
    totalItems: number
    pageSize: number
    onPageChange: (page: number) => void
    onPageSizeChange?: (size: number) => void
    className?: string
}

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100]

export function Pagination({
    currentPage,
    totalPages,
    totalItems,
    pageSize,
    onPageChange,
    onPageSizeChange,
    className,
}: PaginationProps) {
    if (totalPages <= 1 && !onPageSizeChange) return null

    const startItem = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1
    const endItem = Math.min(currentPage * pageSize, totalItems)

    return (
        <div
            className={cn(
                "flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between",
                className
            )}
        >
            <div className="flex flex-wrap items-center gap-3">
                <p className="text-xs text-muted-foreground">
                    Showing <span className="font-medium text-foreground">{startItem}</span> to{" "}
                    <span className="font-medium text-foreground">{endItem}</span> of{" "}
                    <span className="font-medium text-foreground">{totalItems}</span> results
                </p>
                {onPageSizeChange && (
                    <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        Rows per page
                        <select
                            value={pageSize}
                            onChange={(e) => onPageSizeChange(Number(e.target.value))}
                            className="h-7 border border-border bg-background px-1.5 text-xs text-foreground outline-none focus:border-ring"
                        >
                            {PAGE_SIZE_OPTIONS.map((size) => (
                                <option key={size} value={size}>
                                    {size}
                                </option>
                            ))}
                        </select>
                    </label>
                )}
            </div>

            <div className="flex items-center gap-1">
                <Button
                    variant="outline"
                    size="xs"
                    disabled={currentPage <= 1}
                    onClick={() => onPageChange(currentPage - 1)}
                    aria-label="Previous page"
                >
                    <ChevronLeft className="size-3" />
                </Button>

                {generatePageNumbers(currentPage, totalPages).map((page, i) =>
                    page === "..." ? (
                        <span key={`ellipsis-${i}`} className="px-1 text-xs text-muted-foreground">
                            ...
                        </span>
                    ) : (
                        <Button
                            key={page}
                            variant={currentPage === page ? "default" : "outline"}
                            size="xs"
                            onClick={() => onPageChange(page as number)}
                        >
                            {page}
                        </Button>
                    )
                )}

                <Button
                    variant="outline"
                    size="xs"
                    disabled={currentPage >= totalPages}
                    onClick={() => onPageChange(currentPage + 1)}
                    aria-label="Next page"
                >
                    <ChevronRight className="size-3" />
                </Button>
            </div>
        </div>
    )
}

function generatePageNumbers(
    current: number,
    total: number
): (number | "...")[] {
    if (total <= 7) {
        return Array.from({ length: total }, (_, i) => i + 1)
    }

    const pages: (number | "...")[] = []

    pages.push(1)

    if (current > 3) {
        pages.push("...")
    }

    const start = Math.max(2, current - 1)
    const end = Math.min(total - 1, current + 1)

    for (let i = start; i <= end; i++) {
        pages.push(i)
    }

    if (current < total - 2) {
        pages.push("...")
    }

    pages.push(total)

    return pages
}