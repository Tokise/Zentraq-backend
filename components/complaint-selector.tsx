"use client"

import { useState, useMemo } from "react"
import { Search, Plus, Check } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Pagination } from "@/components/pagination"
import { toast } from "sonner"

export type ComplaintSelectorProps = {
    complaints: string[]
    selected: string[]
    onSelect: (complaint: string) => void
    onAddNew: (complaint: string) => Promise<void>
    pageSize?: number
    currentPage?: number
    onPageChange?: (page: number) => void
}

export function ComplaintSelector({
    complaints,
    selected,
    onSelect,
    onAddNew,
    pageSize = 5,
    currentPage = 1,
    onPageChange,
}: ComplaintSelectorProps) {
    const [search, setSearch] = useState("")
    const [showAddDialog, setShowAddDialog] = useState(false)
    const [newComplaint, setNewComplaint] = useState("")
    const [adding, setAdding] = useState(false)

    // Sort: most recently selected items first, then alphabetical
    const sorted = useMemo(() => {
        const trimmed = search.trim().toLowerCase()
        const list = complaints.filter((c) => !trimmed || c.toLowerCase().includes(trimmed))

        // Separate selected and unselected
        const selectedSet = new Set(selected.map((s) => s.toLowerCase()))
        const selectedItems: string[] = []
        const unselected: string[] = []

        // Preserve selected order and find them in list
        for (const s of selected) {
            const found = list.find((c) => c.toLowerCase() === s.toLowerCase())
            if (found) selectedItems.push(found)
        }

        // Unselected items in alphabetical order
        for (const c of list) {
            if (!selectedSet.has(c.toLowerCase())) unselected.push(c)
        }
        unselected.sort((a, b) => a.localeCompare(b))

        return [...selectedItems, ...unselected]
    }, [complaints, search, selected])

    const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize))
    const safePage = Math.min(currentPage, totalPages)
    const paginated = sorted.slice(
        (safePage - 1) * pageSize,
        safePage * pageSize
    )

    async function handleAddNew() {
        if (!newComplaint.trim() || adding) return

        // Check for duplicates
        const exists = complaints.some(
            (c) => c.toLowerCase() === newComplaint.trim().toLowerCase()
        )
        if (exists) {
            toast.error("This complaint already exists")
            return
        }

        setAdding(true)
        try {
            await onAddNew(newComplaint.trim())
            // Auto-select the newly added complaint
            onSelect(newComplaint.trim())
            setNewComplaint("")
            setShowAddDialog(false)
            toast.success("Complaint added and selected")
            // Reset to page 1 to show new complaint at top
            onPageChange?.(1)
        } catch (err: any) {
            toast.error(err.message || "Failed to add complaint")
        } finally {
            setAdding(false)
        }
    }

    function handleToggle(complaint: string) {
        onSelect(complaint)
    }

    return (
        <div className="space-y-4 mt-2">
            {/* Search */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                <Input
                    placeholder="Search complaints..."
                    value={search}
                    onChange={(e) => {
                        setSearch(e.target.value)
                        onPageChange?.(1)
                    }}
                    className="pl-9"
                />
            </div>

            {/* Complaints Table */}
            <div className="border border-border bg-card">
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-16">Select</TableHead>
                                <TableHead>Complaint Type</TableHead>
                                <TableHead className="w-32 text-right">
                                    <Button
                                        onClick={() => setShowAddDialog(true)}
                                        size="sm"
                                        variant="outline"
                                        className="h-7 px-2 text-xs"
                                    >
                                        <Plus className="size-3 mr-1" />
                                        Add Custom
                                    </Button>
                                </TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {paginated.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={3} className="px-4 py-8 text-center text-sm text-muted-foreground">
                                        No complaints found
                                    </TableCell>
                                </TableRow>
                            ) : (
                                paginated.map((complaint) => {
                                    const isSelected = selected.some((s) => s.toLowerCase() === complaint.toLowerCase())
                                    return (
                                        <TableRow
                                            key={complaint}
                                            className="cursor-pointer hover:bg-muted/50 transition-colors"
                                            onClick={() => handleToggle(complaint)}
                                        >
                                            <TableCell className="px-4 py-3">
                                                <div className="flex items-center justify-center">
                                                    <div
                                                        className={`flex size-4 items-center justify-center border ${isSelected
                                                                ? "border-primary bg-primary"
                                                                : "border-muted-foreground/50"
                                                            }`}
                                                    >
                                                        {isSelected && (
                                                            <Check className="size-3 text-primary-foreground" />
                                                        )}
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell className="px-4 py-3 text-sm">{complaint}</TableCell>
                                            <TableCell className="px-4 py-3 text-xs text-muted-foreground">
                                                {isSelected ? "Selected" : ""}
                                            </TableCell>
                                        </TableRow>
                                    )
                                })
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>

            {/* Pagination */}
            {totalPages > 1 && onPageChange && (
                <Pagination
                    currentPage={safePage}
                    totalPages={totalPages}
                    totalItems={sorted.length}
                    pageSize={pageSize}
                    onPageChange={onPageChange}
                />
            )}

            {/* Add Complaint Dialog */}
            <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Add Custom Complaint</DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Complaint Description</label>
                            <Input
                                placeholder="Enter the complaint details..."
                                value={newComplaint}
                                onChange={(e) => setNewComplaint(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                        e.preventDefault()
                                        handleAddNew()
                                    }
                                }}
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleAddNew} disabled={!newComplaint.trim() || adding}>
                            {adding ? "Adding..." : "Add Complaint"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}