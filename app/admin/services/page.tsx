"use client"

import { useState, useEffect, useCallback } from "react"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Pagination } from "@/components/pagination"
import { Loader2, Plus, Search, Archive, RotateCcw, Pencil, RefreshCw } from "lucide-react"
import {
    getServicesAction,
    createServiceAction,
    updateServiceAction,
    archiveServiceAction,
    restoreServiceAction,
    type ServiceDTO,
    type ServiceCategory,
} from "./actions"

const PAGE_SIZE = 10

const CATEGORY_LABELS: Record<ServiceCategory, string> = {
    health_program: "Health Program",
    medical_clearance: "Medical Clearance",
    consultation_service: "Consultation Service",
    other: "Other",
}

const CATEGORY_COLORS: Record<ServiceCategory, string> = {
    health_program: "bg-emerald-50 text-emerald-700 border-emerald-200",
    medical_clearance: "bg-blue-50 text-blue-700 border-blue-200",
    consultation_service: "bg-purple-50 text-purple-700 border-purple-200",
    other: "bg-zinc-50 text-zinc-700 border-zinc-200",
}

export default function ServicesPage() {
    const [services, setServices] = useState<ServiceDTO[]>([])
    const [loading, setLoading] = useState(true)
    const [page, setPage] = useState(1)
    const [totalCount, setTotalCount] = useState(0)
    const [searchQuery, setSearchQuery] = useState("")
    const [categoryFilter, setCategoryFilter] = useState("")
    const [showArchived, setShowArchived] = useState(false)
    const [showCreate, setShowCreate] = useState(false)
    const [editingService, setEditingService] = useState<ServiceDTO | null>(null)
    const [form, setForm] = useState({
        name: "",
        description: "",
        category: "health_program" as ServiceCategory,
        durationMinutes: "",
        price: "",
    })

    const fetchServices = useCallback(async () => {
        setLoading(true)
        try {
            const res = await getServicesAction({
                page,
                pageSize: PAGE_SIZE,
                searchQuery,
                categoryFilter: categoryFilter || undefined,
                includeArchived: showArchived,
            })
            if (res.error) {
                toast.error(res.error)
                setServices([])
                setTotalCount(0)
            } else {
                setServices(res.services)
                setTotalCount(res.totalCount)
            }
        } catch (err: any) {
            toast.error(err?.message || "Failed to load services")
        } finally {
            setLoading(false)
        }
    }, [page, searchQuery, categoryFilter, showArchived])

    useEffect(() => {
        fetchServices()
    }, [fetchServices])

    const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

    function resetForm() {
        setForm({ name: "", description: "", category: "health_program", durationMinutes: "", price: "" })
    }

    async function handleCreate() {
        if (!form.name.trim()) {
            toast.error("Service name is required")
            return
        }
        const res = await createServiceAction({
            name: form.name,
            description: form.description || undefined,
            category: form.category,
            durationMinutes: form.durationMinutes ? parseInt(form.durationMinutes) : undefined,
            price: form.price ? parseFloat(form.price) : undefined,
        })
        if (res.error) toast.error(res.error)
        else {
            toast.success("Service created")
            setShowCreate(false)
            resetForm()
            fetchServices()
        }
    }

    async function handleUpdate() {
        if (!editingService) return
        if (!form.name.trim()) {
            toast.error("Service name is required")
            return
        }
        const res = await updateServiceAction({
            id: editingService.id,
            name: form.name,
            description: form.description || undefined,
            category: form.category,
            durationMinutes: form.durationMinutes ? parseInt(form.durationMinutes) : undefined,
            price: form.price ? parseFloat(form.price) : undefined,
        })
        if (res.error) toast.error(res.error)
        else {
            toast.success("Service updated")
            setEditingService(null)
            resetForm()
            fetchServices()
        }
    }

    async function handleArchive(id: string) {
        if (!confirm("Archive this service?")) return
        const res = await archiveServiceAction(id)
        if (res.error) toast.error(res.error)
        else {
            toast.success("Service archived")
            fetchServices()
        }
    }

    async function handleRestore(id: string) {
        const res = await restoreServiceAction(id)
        if (res.error) toast.error(res.error)
        else {
            toast.success("Service restored")
            fetchServices()
        }
    }

    return (
        <div className="space-y-6">
            <PageHeader
                title="Services"
                description="Manage health programs and medical clearance services."
            />

            <div className="flex flex-wrap items-center gap-3">
                <div className="relative flex-1 min-w-[200px] max-w-xs">
                    <Search className="absolute left-2.5 top-2.5 size-4 text-zinc-400" />
                    <Input
                        placeholder="Search services..."
                        value={searchQuery}
                        onChange={(e) => { setSearchQuery(e.target.value); setPage(1) }}
                        className="pl-8 h-9 text-sm"
                    />
                </div>

                <select
                    value={categoryFilter}
                    onChange={(e) => { setCategoryFilter(e.target.value); setPage(1) }}
                    className="h-9 px-3 rounded-md border border-zinc-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
                >
                    <option value="">All Categories</option>
                    {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                        <option key={key} value={key}>{label}</option>
                    ))}
                </select>

                <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                        type="checkbox"
                        checked={showArchived}
                        onChange={(e) => { setShowArchived(e.target.checked); setPage(1) }}
                        className="size-4"
                    />
                    Show archived
                </label>

                <Button
                    variant="outline"
                    size="sm"
                    onClick={fetchServices}
                    disabled={loading}
                    className="h-9 cursor-pointer"
                >
                    <RefreshCw className={`size-3.5 mr-1 ${loading ? "animate-spin" : ""}`} />
                    Refresh
                </Button>

                <div className="ml-auto">
                    <Button onClick={() => { setShowCreate(true); resetForm() }} className="cursor-pointer">
                        <Plus className="size-4 mr-1" /> Add Service
                    </Button>
                </div>
            </div>

            <Card className="shadow-sm">
                <CardContent className="p-0">
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="size-5 animate-spin text-muted-foreground" />
                        </div>
                    ) : services.length === 0 ? (
                        <div className="py-12 text-center text-sm text-muted-foreground">
                            No services found.
                        </div>
                    ) : (
                        <>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Name</TableHead>
                                        <TableHead>Category</TableHead>
                                        <TableHead>Description</TableHead>
                                        <TableHead>Duration</TableHead>
                                        <TableHead>Price</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead className="w-24 text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {services.map((service) => (
                                        <TableRow key={service.id}>
                                            <TableCell className="font-medium">{service.name}</TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className={`text-[10px] ${CATEGORY_COLORS[service.category] || ""}`}>
                                                    {CATEGORY_LABELS[service.category] || service.category}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-muted-foreground text-sm max-w-[200px] truncate">
                                                {service.description || "—"}
                                            </TableCell>
                                            <TableCell className="text-sm">
                                                {service.duration_minutes ? `${service.duration_minutes} min` : "—"}
                                            </TableCell>
                                            <TableCell className="text-sm">
                                                {service.price !== null ? `₱${service.price.toFixed(2)}` : "—"}
                                            </TableCell>
                                            <TableCell>
                                                {service.is_archived ? (
                                                    <Badge variant="outline" className="text-[10px] bg-zinc-100 text-zinc-500">Archived</Badge>
                                                ) : service.is_active ? (
                                                    <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700">Active</Badge>
                                                ) : (
                                                    <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700">Inactive</Badge>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex justify-end gap-1">
                                                    {service.is_archived ? (
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="size-8"
                                                            title="Restore"
                                                            onClick={() => handleRestore(service.id)}
                                                        >
                                                            <RotateCcw className="size-4" />
                                                        </Button>
                                                    ) : (
                                                        <>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="size-8"
                                                                title="Edit"
                                                                onClick={() => {
                                                                    setEditingService(service)
                                                                    setForm({
                                                                        name: service.name,
                                                                        description: service.description || "",
                                                                        category: service.category,
                                                                        durationMinutes: service.duration_minutes?.toString() || "",
                                                                        price: service.price?.toString() || "",
                                                                    })
                                                                }}
                                                            >
                                                                <Pencil className="size-4" />
                                                            </Button>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="size-8 text-destructive hover:text-destructive"
                                                                title="Archive"
                                                                onClick={() => handleArchive(service.id)}
                                                            >
                                                                <Archive className="size-4" />
                                                            </Button>
                                                        </>
                                                    )}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>

                            <div className="mt-4">
                                <Pagination
                                    currentPage={page}
                                    totalPages={totalPages}
                                    totalItems={totalCount}
                                    pageSize={PAGE_SIZE}
                                    onPageChange={setPage}
                                />
                            </div>
                        </>
                    )}
                </CardContent>
            </Card>

            {/* Create Service Dialog */}
            <Dialog open={showCreate} onOpenChange={setShowCreate}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Add Service</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-1.5">
                            <Label className="text-xs">Service Name *</Label>
                            <Input
                                value={form.name}
                                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                                placeholder="e.g. Annual Physical Exam"
                                className="h-9"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs">Category</Label>
                            <select
                                value={form.category}
                                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as ServiceCategory }))}
                                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                            >
                                {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                                    <option key={key} value={key}>{label}</option>
                                ))}
                            </select>
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs">Description</Label>
                            <Input
                                value={form.description}
                                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                                placeholder="Brief description of the service"
                                className="h-9"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label className="text-xs">Duration (minutes)</Label>
                                <Input
                                    type="number"
                                    min="0"
                                    value={form.durationMinutes}
                                    onChange={(e) => setForm((f) => ({ ...f, durationMinutes: e.target.value }))}
                                    placeholder="e.g. 30"
                                    className="h-9"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs">Price (₱)</Label>
                                <Input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={form.price}
                                    onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                                    placeholder="e.g. 150.00"
                                    className="h-9"
                                />
                            </div>
                        </div>
                    </div>
                    <DialogFooter className="gap-2">
                        <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
                        <Button onClick={handleCreate}>Create Service</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Edit Service Dialog */}
            <Dialog open={!!editingService} onOpenChange={() => setEditingService(null)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Edit Service</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-1.5">
                            <Label className="text-xs">Service Name *</Label>
                            <Input
                                value={form.name}
                                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                                className="h-9"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs">Category</Label>
                            <select
                                value={form.category}
                                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as ServiceCategory }))}
                                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                            >
                                {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                                    <option key={key} value={key}>{label}</option>
                                ))}
                            </select>
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs">Description</Label>
                            <Input
                                value={form.description}
                                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                                className="h-9"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label className="text-xs">Duration (minutes)</Label>
                                <Input
                                    type="number"
                                    min="0"
                                    value={form.durationMinutes}
                                    onChange={(e) => setForm((f) => ({ ...f, durationMinutes: e.target.value }))}
                                    className="h-9"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs">Price (₱)</Label>
                                <Input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={form.price}
                                    onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                                    className="h-9"
                                />
                            </div>
                        </div>
                    </div>
                    <DialogFooter className="gap-2">
                        <Button variant="outline" onClick={() => setEditingService(null)}>Cancel</Button>
                        <Button onClick={handleUpdate}>Save Changes</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}