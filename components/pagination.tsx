import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"

type PaginationProps = {
    currentPage: number
    totalPages: number
    totalItems: number
    pageSize: number
    onPageChange: (page: number) => void
    className?: string
}

export function Pagination({
    currentPage,
    totalPages,
    totalItems,
    pageSize,
    onPageChange,
    className,
}: PaginationProps) {
    if (totalPages <= 1) return null

    const startItem = (currentPage - 1) * pageSize + 1
    const endItem = Math.min(currentPage * pageSize, totalItems)

    return (
        <div
            className={cn(
                "flex items-center justify-between border-t border-border pt-4",
                className
            )}
        >
            <p className="text-xs text-muted-foreground">
                Showing {startItem} to {endItem} of {totalItems} results
            </p>

            <div className="flex items-center gap-1">
                <Button
                    variant="outline"
                    size="xs"
                    disabled={currentPage <= 1}
                    onClick={() => onPageChange(currentPage - 1)}
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