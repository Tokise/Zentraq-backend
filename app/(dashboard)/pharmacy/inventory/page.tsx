"use client"

import { useState, useMemo, useEffect } from "react"
import {
  Search,
  Calendar as CalendarIcon,
  Package,
  AlertTriangle,
  Clock,
  Filter,
  ArrowUpDown,
  Plus,
  Pill,
  ShieldAlert,
} from "lucide-react"

import { PageHeader } from "@/components/page-header"
import { SectionHeader } from "@/components/section-header"
import { StatusBadge } from "@/components/status-badge"

import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

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
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

import { Pagination } from "@/components/pagination"

type InventoryItem = {
  id: string
  item_code: string
  batch_number: string
  medicine_name: string
  category: "Analgesics" | "Antibiotics" | "Antihistamines" | "First Aid" | "Vitamins" | "Gastrointestinal"
  stock_quantity: number
  unit: string
  reorder_level: number
  expiration_date: string // YYYY-MM-DD
  location: string
  status: "In Stock" | "Low Stock" | "Out of Stock" | "Expiring Soon"
  notes?: string
}

const PAGE_SIZE = 8

// Mock sample inventory records
const MOCK_INVENTORY: InventoryItem[] = [
  {
    id: "inv-001",
    item_code: "MED-PAR-500",
    batch_number: "BAT-2026-081",
    medicine_name: "Paracetamol 500mg Tablet",
    category: "Analgesics",
    stock_quantity: 450,
    unit: "tablets",
    reorder_level: 100,
    expiration_date: "2027-05-15",
    location: "Cabinet A-1",
    status: "In Stock",
    notes: "High demand during flu season.",
  },
  {
    id: "inv-002",
    item_code: "MED-IBU-400",
    batch_number: "BAT-2026-042",
    medicine_name: "Ibuprofen 400mg Tablet",
    category: "Analgesics",
    stock_quantity: 24,
    unit: "tablets",
    reorder_level: 50,
    expiration_date: "2026-11-30",
    location: "Cabinet A-2",
    status: "Low Stock",
    notes: "Reorder requested from supplier.",
  },
  {
    id: "inv-003",
    item_code: "MED-AMX-500",
    batch_number: "BAT-2026-019",
    medicine_name: "Amoxicillin 500mg Capsule",
    category: "Antibiotics",
    stock_quantity: 0,
    unit: "capsules",
    reorder_level: 30,
    expiration_date: "2027-01-20",
    location: "Cabinet B-1",
    status: "Out of Stock",
    notes: "Requires prescription clearance.",
  },
  {
    id: "inv-004",
    item_code: "MED-CET-10",
    batch_number: "BAT-2026-105",
    medicine_name: "Cetirizine 10mg Tablet",
    category: "Antihistamines",
    stock_quantity: 180,
    unit: "tablets",
    reorder_level: 40,
    expiration_date: "2026-08-15", // Expiring soon relative to current date
    location: "Cabinet A-3",
    status: "Expiring Soon",
    notes: "Prioritize dispensing this batch.",
  },
  {
    id: "inv-005",
    item_code: "MED-LOR-10",
    batch_number: "BAT-2026-092",
    medicine_name: "Loratadine 10mg Tablet",
    category: "Antihistamines",
    stock_quantity: 320,
    unit: "tablets",
    reorder_level: 60,
    expiration_date: "2027-09-10",
    location: "Cabinet A-3",
    status: "In Stock",
  },
  {
    id: "inv-006",
    item_code: "MED-VIT-C",
    batch_number: "BAT-2026-301",
    medicine_name: "Vitamin C 500mg Tablet",
    category: "Vitamins",
    stock_quantity: 15,
    unit: "tablets",
    reorder_level: 100,
    expiration_date: "2027-12-01",
    location: "Cabinet C-1",
    status: "Low Stock",
  },
  {
    id: "inv-007",
    item_code: "MED-ORS-P",
    batch_number: "BAT-2026-210",
    medicine_name: "Oral Rehydration Salts (ORS)",
    category: "Gastrointestinal",
    stock_quantity: 120,
    unit: "sachets",
    reorder_level: 30,
    expiration_date: "2028-03-31",
    location: "Shelf D-2",
    status: "In Stock",
  },
  {
    id: "inv-008",
    item_code: "MED-BET-SOL",
    batch_number: "BAT-2026-055",
    medicine_name: "Povidone Iodine 10% Solution",
    category: "First Aid",
    stock_quantity: 45,
    unit: "bottles",
    reorder_level: 10,
    expiration_date: "2027-08-20",
    location: "First Aid Rack",
    status: "In Stock",
  },
]

import { useSearchParams } from "next/navigation"

export default function InventoryPage() {
  const searchParams = useSearchParams()
  const targetId = searchParams.get("id") || searchParams.get("item")
  const [inventoryList, setInventoryList] = useState<InventoryItem[]>(MOCK_INVENTORY)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [categoryFilter, setCategoryFilter] = useState<string>("all")
  const [sortOrder, setTimeSortOrder] = useState<"asc" | "desc">("asc")

  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null)
  const [page, setPage] = useState(1)

  // Auto-pop up targeted inventory item detail modal when ?id= or ?item= parameter is present
  useEffect(() => {
    if (targetId && inventoryList.length > 0) {
      const match = inventoryList.find(
        (item) => item.id === targetId || item.item_code === targetId || item.medicine_name.toLowerCase().includes(targetId.toLowerCase())
      )
      if (match) {
        setSelectedItem(match)
      }
    }
  }, [targetId, inventoryList])

  // Today's date banner string
  const currentDateFormatted = useMemo(() => {
    return new Date().toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    })
  }, [])

  // Calculate high-level summary metrics
  const metrics = useMemo(() => {
    const totalItems = inventoryList.length
    const lowStockCount = inventoryList.filter(
      (item) => item.status === "Low Stock" || item.stock_quantity <= item.reorder_level
    ).length
    const outOfStockCount = inventoryList.filter((item) => item.status === "Out of Stock" || item.stock_quantity === 0).length
    const expiringCount = inventoryList.filter((item) => item.status === "Expiring Soon").length

    return { totalItems, lowStockCount, outOfStockCount, expiringCount }
  }, [inventoryList])

  // Filter & Sort Logic
  const filteredAndSortedItems = useMemo(() => {
    let result = [...inventoryList]

    // 1. Text Search
    const keyword = searchQuery.toLowerCase().trim()
    if (keyword) {
      result = result.filter((item) => {
        const name = item.medicine_name?.toLowerCase() ?? ""
        const code = item.item_code?.toLowerCase() ?? ""
        const batch = item.batch_number?.toLowerCase() ?? ""
        const loc = item.location?.toLowerCase() ?? ""

        return (
          name.includes(keyword) ||
          code.includes(keyword) ||
          batch.includes(keyword) ||
          loc.includes(keyword)
        )
      })
    }

    // 2. Status Filter
    if (statusFilter !== "all") {
      result = result.filter((item) => item.status === statusFilter)
    }

    // 3. Category Filter
    if (categoryFilter !== "all") {
      result = result.filter((item) => item.category === categoryFilter)
    }

    // 4. Quantity Sorting
    result.sort((a, b) => {
      return sortOrder === "asc"
        ? a.stock_quantity - b.stock_quantity
        : b.stock_quantity - a.stock_quantity
    })

    return result
  }, [inventoryList, searchQuery, statusFilter, categoryFilter, sortOrder])

  const totalPages = Math.max(1, Math.ceil(filteredAndSortedItems.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)

  const paginatedItems = useMemo(() => {
    return filteredAndSortedItems.slice(
      (safePage - 1) * PAGE_SIZE,
      safePage * PAGE_SIZE
    )
  }, [filteredAndSortedItems, safePage])

  const getStatusVariant = (status: InventoryItem["status"]) => {
    switch (status) {
      case "In Stock":
        return "success"
      case "Low Stock":
        return "warning"
      case "Out of Stock":
        return "danger"
      case "Expiring Soon":
        return "warning"
      default:
        return "default"
    }
  }

  const handleResetFilters = () => {
    setSearchQuery("")
    setStatusFilter("all")
    setCategoryFilter("all")
    setTimeSortOrder("asc")
    setPage(1)
  }

  return (
    <div className="space-y-8">
      {/* Today's Date Banner */}
      <div className="flex items-center gap-2 text-xs font-semibold text-primary uppercase tracking-wider bg-primary/10 px-3.5 py-1.5 rounded-md w-fit">
        <CalendarIcon className="size-3.5" />
        <span>Today: {currentDateFormatted}</span>
      </div>

      <PageHeader
        title="Pharmacy Inventory"
        description="Monitor medicine stock levels, batch numbers, reorder thresholds, and expiration dates."
      />

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium">Total Products</p>
              <p className="text-2xl font-bold mt-1">{metrics.totalItems}</p>
            </div>
            <div className="p-2.5 rounded-lg bg-primary/10 text-primary">
              <Package className="size-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium">Low Stock Items</p>
              <p className="text-2xl font-bold text-amber-600 mt-1">{metrics.lowStockCount}</p>
            </div>
            <div className="p-2.5 rounded-lg bg-amber-100 text-amber-700">
              <AlertTriangle className="size-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium">Out of Stock</p>
              <p className="text-2xl font-bold text-rose-600 mt-1">{metrics.outOfStockCount}</p>
            </div>
            <div className="p-2.5 rounded-lg bg-rose-100 text-rose-700">
              <ShieldAlert className="size-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium">Expiring Soon</p>
              <p className="text-2xl font-bold text-orange-600 mt-1">{metrics.expiringCount}</p>
            </div>
            <div className="p-2.5 rounded-lg bg-orange-100 text-orange-700">
              <Clock className="size-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-sm">
        <CardHeader>
          <SectionHeader
            title="Medicine Stock Directory"
            description={`${filteredAndSortedItems.length} item(s) listed in inventory`}
          />

          {/* Filters & Control Bar */}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            {/* Search input */}
            <div className="relative min-w-[220px] flex-1 sm:flex-none sm:w-64">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search code, name, batch, location..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  setPage(1)
                }}
                className="pl-9 h-9 text-sm"
              />
            </div>

            {/* Status Dropdown */}
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value)
                setPage(1)
              }}
              className="h-9 rounded-md border border-input bg-background px-3 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="all">All Statuses</option>
              <option value="In Stock">In Stock</option>
              <option value="Low Stock">Low Stock</option>
              <option value="Out of Stock">Out of Stock</option>
              <option value="Expiring Soon">Expiring Soon</option>
            </select>

            {/* Category Dropdown */}
            <select
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value)
                setPage(1)
              }}
              className="h-9 rounded-md border border-input bg-background px-3 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="all">All Categories</option>
              <option value="Analgesics">Analgesics</option>
              <option value="Antibiotics">Antibiotics</option>
              <option value="Antihistamines">Antihistamines</option>
              <option value="First Aid">First Aid</option>
              <option value="Vitamins">Vitamins</option>
              <option value="Gastrointestinal">Gastrointestinal</option>
            </select>

            {/* Sort Toggle */}
            <button
              type="button"
              onClick={() => setTimeSortOrder((prev) => (prev === "asc" ? "desc" : "asc"))}
              className="flex items-center gap-1.5 h-9 px-3 rounded-md border text-xs font-medium hover:bg-muted transition-colors"
            >
              <ArrowUpDown className="size-3.5 text-muted-foreground" />
              <span>{sortOrder === "asc" ? "Lowest Quantity First" : "Highest Quantity First"}</span>
            </button>

            {/* Reset Filters */}
            {(searchQuery || statusFilter !== "all" || categoryFilter !== "all") && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="text-xs text-muted-foreground underline hover:text-foreground ml-auto"
              >
                Reset filters
              </button>
            )}
          </div>
        </CardHeader>

        <CardContent>
          {paginatedItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Package className="mb-4 size-12 text-muted-foreground" />
              <h3 className="text-lg font-semibold">No inventory items found</h3>
              <p className="text-sm text-muted-foreground">
                No medicine matches your search or filter criteria.
              </p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item Code</TableHead>
                    <TableHead>Medicine Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Stock Level</TableHead>
                    <TableHead>Batch / Expiration</TableHead>
                    <TableHead>Storage Loc.</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedItems.map((item) => {
                    const isLow = item.stock_quantity <= item.reorder_level

                    return (
                      <TableRow
                        key={item.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => setSelectedItem(item)}
                      >
                        <TableCell className="font-mono text-xs font-semibold">
                          {item.item_code}
                        </TableCell>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <Pill className="size-4 text-primary shrink-0" />
                            <span>{item.medicine_name}</span>
                          </div>
                        </TableCell>
                        <TableCell>{item.category}</TableCell>
                        <TableCell>
                          <span
                            className={`font-semibold ${isLow ? "text-amber-600" : "text-foreground"
                              }`}
                          >
                            {item.stock_quantity} {item.unit}
                          </span>
                          <span className="text-[10px] text-muted-foreground block">
                            (Min: {item.reorder_level})
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col text-xs">
                            <span className="font-mono">{item.batch_number}</span>
                            <span className="text-muted-foreground flex items-center gap-1 text-[11px]">
                              <Clock className="size-3 inline" /> Exp: {item.expiration_date}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>{item.location}</TableCell>
                        <TableCell>
                          <StatusBadge status={getStatusVariant(item.status)}>
                            {item.status}
                          </StatusBadge>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>

              <div className="mt-4">
                <Pagination
                  currentPage={safePage}
                  totalPages={totalPages}
                  totalItems={filteredAndSortedItems.length}
                  pageSize={PAGE_SIZE}
                  onPageChange={setPage}
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Item Details / Restock Modal */}
      <Dialog
        open={selectedItem !== null}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedItem(null)
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pill className="size-5 text-primary" />
              <span>Medicine Stock Information</span>
            </DialogTitle>
          </DialogHeader>

          {selectedItem && (
            <div className="space-y-5">
              <div className="flex items-center justify-between border-b pb-3">
                <div>
                  <p className="text-xs text-muted-foreground">Item Code</p>
                  <p className="text-lg font-bold font-mono text-primary">{selectedItem.item_code}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground mb-1">Status</p>
                  <StatusBadge status={getStatusVariant(selectedItem.status)}>
                    {selectedItem.status}
                  </StatusBadge>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Medicine Name</p>
                  <p className="font-bold text-base">{selectedItem.medicine_name}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Category</p>
                  <p className="font-medium">{selectedItem.category}</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 bg-muted/40 p-3 rounded-lg">
                <div>
                  <p className="text-xs text-muted-foreground">Current Stock</p>
                  <p className="text-lg font-bold">
                    {selectedItem.stock_quantity} {selectedItem.unit}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Reorder Level</p>
                  <p className="text-lg font-semibold">{selectedItem.reorder_level}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Storage Location</p>
                  <p className="text-sm font-medium">{selectedItem.location}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Batch Number</p>
                  <p className="font-mono text-sm font-medium">{selectedItem.batch_number}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Expiration Date</p>
                  <p className="font-medium text-sm">{selectedItem.expiration_date}</p>
                </div>
              </div>

              {selectedItem.notes && (
                <div>
                  <p className="text-xs text-muted-foreground">Storage & Handling Notes</p>
                  <p className="text-xs bg-muted/40 p-3 rounded-md mt-1">
                    {selectedItem.notes}
                  </p>
                </div>
              )}

              <div className="pt-3 border-t flex justify-end gap-2">
                <Button
                  onClick={() => setSelectedItem(null)}
                  variant="outline"
                  className="text-xs"
                >
                  Close
                </Button>
                <Button
                  onClick={() => {
                    alert(`Restock request triggered for ${selectedItem.medicine_name}`)
                    setSelectedItem(null)
                  }}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs flex items-center gap-1.5"
                >
                  <Plus className="size-3.5" />
                  <span>Restock Batch</span>
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
} 