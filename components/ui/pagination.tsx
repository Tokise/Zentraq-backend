import * as React from "react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ChevronLeftIcon, ChevronRightIcon, MoreHorizontalIcon } from "lucide-react"

interface DataTablePaginationProps {
  currentPage: number
  totalPages: number
  totalItems: number
  pageSize?: number
  onPageChange: (page: number) => void
  onPageSizeChange?: (size: number) => void
  className?: string
}

// Slices a client-side table collection into stable page-size-10 rows.
function useTablePagination<T>(items: T[], pageSize = 10) {
  const [currentPage, setCurrentPage] = React.useState(1)
  const totalPages = Math.ceil(items.length / pageSize)
  const safePage = Math.min(
    Math.max(currentPage, 1),
    Math.max(totalPages, 1),
  )

  // Keeps page changes within the collection's current boundaries.
  const changePage = React.useCallback(
    (page: number) => {
      setCurrentPage(
        Math.min(Math.max(page, 1), Math.max(totalPages, 1)),
      )
    },
    [totalPages],
  )

  const paginatedItems = React.useMemo(() => {
    const start = (safePage - 1) * pageSize
    return items.slice(start, start + pageSize)
  }, [items, pageSize, safePage])

  return {
    currentPage: safePage,
    paginatedItems,
    pageSize,
    setCurrentPage: changePage,
    totalItems: items.length,
    totalPages,
  }
}

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100]

function Pagination({ className, ...props }: React.ComponentProps<"nav">) {
  return (
    <nav
      role="navigation"
      aria-label="pagination"
      data-slot="pagination"
      className={cn("mx-auto flex w-full justify-center", className)}
      {...props}
    />
  )
}

function PaginationContent({
  className,
  ...props
}: React.ComponentProps<"ul">) {
  return (
    <ul
      data-slot="pagination-content"
      className={cn("flex items-center gap-1", className)}
      {...props}
    />
  )
}

function PaginationItem({ ...props }: React.ComponentProps<"li">) {
  return <li data-slot="pagination-item" {...props} />
}

type PaginationLinkProps = {
  isActive?: boolean
} & Pick<React.ComponentProps<typeof Button>, "size"> &
  React.ComponentProps<"a">

function PaginationLink({
  className,
  isActive,
  size = "icon",
  ...props
}: PaginationLinkProps) {
  return (
    <Button
      variant={isActive ? "outline" : "ghost"}
      size={size}
      className={cn(className)}
      nativeButton={false}
      render={
        <a
          aria-current={isActive ? "page" : undefined}
          data-slot="pagination-link"
          data-active={isActive}
          {...props}
        />
      }
    />
  )
}

function PaginationPrevious({
  className,
  text = "Previous",
  ...props
}: React.ComponentProps<typeof PaginationLink> & { text?: string }) {
  return (
    <PaginationLink
      aria-label="Go to previous page"
      size="default"
      className={cn("pl-2!", className)}
      {...props}
    >
      <ChevronLeftIcon data-icon="inline-start" />
      <span className="hidden sm:block">{text}</span>
    </PaginationLink>
  )
}

function PaginationNext({
  className,
  text = "Next",
  ...props
}: React.ComponentProps<typeof PaginationLink> & { text?: string }) {
  return (
    <PaginationLink
      aria-label="Go to next page"
      size="default"
      className={cn("pr-2!", className)}
      {...props}
    >
      <span className="hidden sm:block">{text}</span>
      <ChevronRightIcon data-icon="inline-end" />
    </PaginationLink>
  )
}

function PaginationEllipsis({
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      aria-hidden
      data-slot="pagination-ellipsis"
      className={cn(
        "flex size-9 items-center justify-center [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    >
      <MoreHorizontalIcon
      />
      <span className="sr-only">More pages</span>
    </span>
  )
}

// Renders boundary-safe application table pagination from the UI primitive.
function DataTablePagination({
  currentPage,
  totalPages,
  totalItems,
  pageSize = 10,
  onPageChange,
  onPageSizeChange,
  className,
}: DataTablePaginationProps) {
  if (totalPages <= 1 && !onPageSizeChange) return null

  const safePage = Math.min(Math.max(currentPage, 1), Math.max(totalPages, 1))
  const startItem = totalItems === 0 ? 0 : (safePage - 1) * pageSize + 1
  const endItem = Math.min(safePage * pageSize, totalItems)

  return (
    <div
      className={cn(
        "flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-xs text-muted-foreground">
          Showing <span className="font-medium text-foreground">{startItem}</span>{" "}
          to <span className="font-medium text-foreground">{endItem}</span>{" "}
          of <span className="font-medium text-foreground">{totalItems}</span>{" "}
          results
        </p>
        {onPageSizeChange && (
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            Rows per page
            <select
              className="h-8 cursor-pointer rounded-md border border-border bg-background px-2 text-xs text-foreground outline-none focus:border-ring"
              onChange={(event) =>
                onPageSizeChange(Number(event.target.value))
              }
              value={pageSize}
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

      <Pagination className="mx-0 w-auto justify-end">
        <PaginationContent>
          <PaginationItem>
            <Button
              aria-label="Previous page"
              disabled={safePage <= 1}
              onClick={() => onPageChange(safePage - 1)}
              size="icon-sm"
              type="button"
              variant="outline"
            >
              <ChevronLeftIcon className="size-4" />
            </Button>
          </PaginationItem>
          {generatePageNumbers(safePage, totalPages).map((page, index) => (
            <PaginationItem key={page === "..." ? `ellipsis-${index}` : page}>
              {page === "..." ? (
                <PaginationEllipsis />
              ) : (
                <Button
                  aria-current={safePage === page ? "page" : undefined}
                  aria-label={`Go to page ${page}`}
                  onClick={() => onPageChange(page)}
                  size="icon-sm"
                  type="button"
                  variant={safePage === page ? "default" : "outline"}
                >
                  {page}
                </Button>
              )}
            </PaginationItem>
          ))}
          <PaginationItem>
            <Button
              aria-label="Next page"
              disabled={safePage >= totalPages}
              onClick={() => onPageChange(safePage + 1)}
              size="icon-sm"
              type="button"
              variant="outline"
            >
              <ChevronRightIcon className="size-4" />
            </Button>
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  )
}

// Produces compact page numbers with ellipses for large result sets.
function generatePageNumbers(
  currentPage: number,
  totalPages: number,
): Array<number | "..."> {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1)
  }

  const pages: Array<number | "..."> = [1]
  if (currentPage > 3) pages.push("...")
  const start = Math.max(2, currentPage - 1)
  const end = Math.min(totalPages - 1, currentPage + 1)
  for (let page = start; page <= end; page += 1) pages.push(page)
  if (currentPage < totalPages - 2) pages.push("...")
  pages.push(totalPages)
  return pages
}

export {
  DataTablePagination,
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  useTablePagination,
}
