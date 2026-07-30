"use client"

import { useState, useMemo, useEffect } from "react"
import {
  Search,
  Pill,
  Plus,
  BookOpen,
  Layers,
  FileSpreadsheet,
  Eye,
  Edit,
  X,
  Info,
  Calendar as CalendarIcon,
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
  DialogFooter,
} from "@/components/ui/dialog"

import { Pagination } from "@/components/pagination"

type CatalogMedicine = {
  id: string
  item_code: string
  generic_name: string
  brand_name: string
  medicine_name: string
  category: "Analgesics" | "Antibiotics" | "Antihistamines" | "First Aid" | "Vitamins" | "Gastrointestinal"
  active_ingredient: string
  dosage_form: string // e.g., Tablet, Capsule, Syrup
  strength: string // e.g., 500 mg, 10 mg/5ml
  route: "Oral" | "Topical" | "Inhalation" | "Injectable"
  prescription_type: "Over-the-Counter" | "Prescription"
  status: "Active" | "Under Review" | "Discontinued"
  description?: string
}

const PAGE_SIZE = 8

const MOCK_CATALOG: CatalogMedicine[] = [
  {
    id: "cat-001",
    item_code: "MED-PAR-500",
    generic_name: "Paracetamol",
    brand_name: "Biogesic / Tempra",
    medicine_name: "Paracetamol 500mg Tablet",
    category: "Analgesics",
    active_ingredient: "Acetaminophen",
    dosage_form: "Tablet",
    strength: "500 mg",
    route: "Oral",
    prescription_type: "Over-the-Counter",
    status: "Active",
    description: "Used for mild to moderate pain relief and fever reduction.",
  },
  {
    id: "cat-002",
    item_code: "MED-IBU-400",
    generic_name: "Ibuprofen",
    brand_name: "Advil / Medicol",
    medicine_name: "Ibuprofen 400mg Tablet",
    category: "Analgesics",
    active_ingredient: "Ibuprofen",
    dosage_form: "Softgel Capsule",
    strength: "400 mg",
    route: "Oral",
    prescription_type: "Over-the-Counter",
    status: "Active",
    description: "Nonsteroidal anti-inflammatory drug (NSAID) for pain and inflammation.",
  },
  {
    id: "cat-003",
    item_code: "MED-AMX-500",
    generic_name: "Amoxicillin",
    brand_name: "Amoxil",
    medicine_name: "Amoxicillin 500mg Capsule",
    category: "Antibiotics",
    active_ingredient: "Amoxicillin Trihydrate",
    dosage_form: "Capsule",
    strength: "500 mg",
    route: "Oral",
    prescription_type: "Prescription",
    status: "Active",
    description: "Broad-spectrum penicillin antibiotic used for bacterial infections.",
  },
  {
    id: "cat-004",
    item_code: "MED-CET-10",
    generic_name: "Cetirizine HCl",
    brand_name: "Virlix / Allercet",
    medicine_name: "Cetirizine 10mg Tablet",
    category: "Antihistamines",
    active_ingredient: "Cetirizine Hydrochloride",
    dosage_form: "Tablet",
    strength: "10 mg",
    route: "Oral",
    prescription_type: "Over-the-Counter",
    status: "Active",
    description: "Second-generation antihistamine for allergic rhinitis and urticaria.",
  },
  {
    id: "cat-005",
    item_code: "MED-VIT-C",
    generic_name: "Ascorbic Acid + Zinc",
    brand_name: "ImmunPro",
    medicine_name: "Vitamin C 500mg Tablet",
    category: "Vitamins",
    active_ingredient: "Ascorbic Acid (500mg) + Zinc (10mg)",
    dosage_form: "Film-Coated Tablet",
    strength: "500 mg / 10 mg",
    route: "Oral",
    prescription_type: "Over-the-Counter",
    status: "Active",
    description: "Nutritional supplement for immune system support.",
  },
  {
    id: "cat-006",
    item_code: "MED-ORS-P",
    generic_name: "Oral Rehydration Salts",
    brand_name: "Hydrite",
    medicine_name: "Oral Rehydration Salts (ORS)",
    category: "Gastrointestinal",
    active_ingredient: "Sodium Chloride, Potassium Chloride, Glucose",
    dosage_form: "Sachet",
    strength: "4.1 g",
    route: "Oral",
    prescription_type: "Over-the-Counter",
    status: "Active",
    description: "Prevents dehydration due to diarrhea and vomiting.",
  },
  {
    id: "cat-007",
    item_code: "MED-LOR-10",
    generic_name: "Loratadine",
    brand_name: "Claritin / Allerta",
    medicine_name: "Loratadine 10mg Tablet",
    category: "Antihistamines",
    active_ingredient: "Loratadine",
    dosage_form: "Tablet",
    strength: "10 mg",
    route: "Oral",
    prescription_type: "Over-the-Counter",
    status: "Active",
    description: "Non-drowsy antihistamine for seasonal allergy symptoms.",
  },
  {
    id: "cat-008",
    item_code: "MED-BET-SOL",
    generic_name: "Povidone Iodine",
    brand_name: "Betadine",
    medicine_name: "Povidone Iodine 10% Solution",
    category: "First Aid",
    active_ingredient: "Povidone Iodine 10%",
    dosage_form: "Topical Solution",
    strength: "10%",
    route: "Topical",
    prescription_type: "Over-the-Counter",
    status: "Active",
    description: "Antiseptic solution for wound skin disinfection.",
  },
]

const INITIAL_FORM_STATE: Omit<CatalogMedicine, "id"> = {
  item_code: "",
  medicine_name: "",
  generic_name: "",
  brand_name: "",
  category: "Analgesics",
  active_ingredient: "",
  dosage_form: "Tablet",
  strength: "",
  route: "Oral",
  prescription_type: "Over-the-Counter",
  status: "Active",
  description: "",
}


import { useSearchParams } from "next/navigation"

export default function MedicinesPage() {
  const searchParams = useSearchParams()
  const targetId = searchParams.get("id") || searchParams.get("item")
  const [catalog, setCatalog] = useState<CatalogMedicine[]>(MOCK_CATALOG)
  const [searchQuery, setSearchQuery] = useState("")
  const [categoryFilter, setCategoryFilter] = useState<string>("all")
  const [typeFilter, setTypeFilter] = useState<string>("all")

  // Modal States
  const [selectedItem, setSelectedItem] = useState<CatalogMedicine | null>(null)
  const [editingItem, setEditingItem] = useState<CatalogMedicine | null>(null)
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [formData, setFormData] = useState<Omit<CatalogMedicine, "id">>(INITIAL_FORM_STATE)

  const [page, setPage] = useState(1)

  // Auto-pop up targeted catalog medicine detail modal when ?id= or ?item= parameter is present
  useEffect(() => {
    if (targetId && catalog.length > 0) {
      const match = catalog.find(
        (m) => m.id === targetId || m.item_code === targetId || m.medicine_name.toLowerCase().includes(targetId.toLowerCase()) || m.generic_name.toLowerCase().includes(targetId.toLowerCase())
      )
      if (match) {
        setSelectedItem(match)
      }
    }
  }, [targetId, catalog])

  // Today's date banner string
  const currentDateFormatted = useMemo(() => {
    return new Date().toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    })
  }, [])

  // Catalog Metrics
  const stats = useMemo(() => {
    const totalEntries = catalog.length
    const prescriptionCount = catalog.filter((c) => c.prescription_type === "Prescription").length
    const otcCount = catalog.filter((c) => c.prescription_type === "Over-the-Counter").length
    const activeCount = catalog.filter((c) => c.status === "Active").length

    return { totalEntries, prescriptionCount, otcCount, activeCount }
  }, [catalog])

  // Search & Filter
  const filteredCatalog = useMemo(() => {
    return catalog.filter((item) => {
      const query = searchQuery.toLowerCase().trim()
      const matchesSearch =
        query === "" ||
        item.medicine_name.toLowerCase().includes(query) ||
        item.generic_name.toLowerCase().includes(query) ||
        item.brand_name.toLowerCase().includes(query) ||
        item.item_code.toLowerCase().includes(query) ||
        item.active_ingredient.toLowerCase().includes(query)

      const matchesCategory =
        categoryFilter === "all" || item.category === categoryFilter

      const matchesType =
        typeFilter === "all" || item.prescription_type === typeFilter

      return matchesSearch && matchesCategory && matchesType
    })
  }, [catalog, searchQuery, categoryFilter, typeFilter])

  const totalPages = Math.max(1, Math.ceil(filteredCatalog.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)

  const paginatedCatalog = useMemo(() => {
    return filteredCatalog.slice(
      (safePage - 1) * PAGE_SIZE,
      safePage * PAGE_SIZE
    )
  }, [filteredCatalog, safePage])

  const getStatusVariant = (status: CatalogMedicine["status"]) => {
    switch (status) {
      case "Active":
        return "success"
      case "Under Review":
        return "warning"
      case "Discontinued":
        return "danger"
      default:
        return "default"
    }
  }

  const handleResetFilters = () => {
    setSearchQuery("")
    setCategoryFilter("all")
    setTypeFilter("all")
    setPage(1)
  }

  // Open Edit Modal & Populate Form State
  const handleOpenEdit = (item: CatalogMedicine) => {
    setEditingItem(item)
    setFormData({
      item_code: item.item_code,
      medicine_name: item.medicine_name,
      generic_name: item.generic_name,
      brand_name: item.brand_name,
      category: item.category,
      active_ingredient: item.active_ingredient,
      dosage_form: item.dosage_form,
      strength: item.strength,
      route: item.route,
      prescription_type: item.prescription_type,
      status: item.status,
      description: item.description ?? "",
    })
  }

  // Open Add Modal & Reset Form State
  const handleOpenAdd = () => {
    setFormData({
      ...INITIAL_FORM_STATE,
      item_code: `MED-NEW-${100 + catalog.length + 1}`,
    })
    setIsAddOpen(true)
  }

  // Save New Item
  const handleSaveNew = (e: React.FormEvent) => {
    e.preventDefault()
    const newEntry: CatalogMedicine = {
      id: `cat-${Date.now()}`,
      ...formData,
      medicine_name: formData.medicine_name || `${formData.generic_name} ${formData.strength} ${formData.dosage_form}`,
    }
    setCatalog([newEntry, ...catalog])
    setIsAddOpen(false)
  }

  // Save Edits
  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingItem) return

    setCatalog((prev) =>
      prev.map((item) =>
        item.id === editingItem.id ? { ...item, ...formData } : item
      )
    )
    setEditingItem(null)
  }

  // Export Formulary Catalog to CSV
  const handleExportCSV = () => {
    if (filteredCatalog.length === 0) return

    const headers = [
      "Item Code",
      "Medicine Name",
      "Generic Name",
      "Brand Name",
      "Category",
      "Active Ingredient",
      "Dosage Form",
      "Strength",
      "Route",
      "Prescription Type",
      "Status",
    ]

    const csvRows = [
      headers.join(","),
      ...filteredCatalog.map((item) =>
        [
          `"${item.item_code}"`,
          `"${item.medicine_name}"`,
          `"${item.generic_name}"`,
          `"${item.brand_name}"`,
          `"${item.category}"`,
          `"${item.active_ingredient}"`,
          `"${item.dosage_form}"`,
          `"${item.strength}"`,
          `"${item.route}"`,
          `"${item.prescription_type}"`,
          `"${item.status}"`,
        ].join(",")
      ),
    ]

    const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.setAttribute("download", `medicine_catalog_${new Date().toISOString().split("T")[0]}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="space-y-6">
      {/* Today's Date Banner */}
      <div className="flex items-center gap-2 text-xs font-semibold text-primary uppercase tracking-wider bg-primary/10 px-3.5 py-1.5 rounded-md w-fit">
        <CalendarIcon className="size-3.5" />
        <span>Today: {currentDateFormatted}</span>
      </div>

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <PageHeader
          title="Medicine Catalog"
          description="Manage official clinic drug listings, classifications, and dosage specs."
        />
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            className="h-9 gap-2 cursor-pointer"
            onClick={handleExportCSV}
          >
            <FileSpreadsheet className="size-4 text-emerald-600" />
            <span>Export Catalog</span>
          </Button>
          <Button size="sm" className="h-9 gap-2 cursor-pointer" onClick={handleOpenAdd}>
            <Plus className="size-4" />
            <span>Add Drug Entry</span>
          </Button>
        </div>
      </div>

      {/* Catalog Metric Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="shadow-sm">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 bg-blue-100 text-blue-700 rounded-lg shrink-0 flex items-center justify-center">
              <BookOpen className="size-5" />
            </div>
            <div className="space-y-0.5">
              <p className="text-xs text-muted-foreground font-medium">Formulary Entries</p>
              <p className="text-2xl font-bold leading-none">{stats.totalEntries}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 bg-emerald-100 text-emerald-700 rounded-lg shrink-0 flex items-center justify-center">
              <Pill className="size-5" />
            </div>
            <div className="space-y-0.5">
              <p className="text-xs text-muted-foreground font-medium">OTC Drugs</p>
              <p className="text-2xl font-bold leading-none">{stats.otcCount}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 bg-indigo-100 text-indigo-700 rounded-lg shrink-0 flex items-center justify-center">
              <Layers className="size-5" />
            </div>
            <div className="space-y-0.5">
              <p className="text-xs text-muted-foreground font-medium">Prescription (Rx)</p>
              <p className="text-2xl font-bold leading-none">{stats.prescriptionCount}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 bg-slate-100 text-slate-700 rounded-lg shrink-0 flex items-center justify-center">
              <Info className="size-5" />
            </div>
            <div className="space-y-0.5">
              <p className="text-xs text-muted-foreground font-medium">Active Status</p>
              <p className="text-2xl font-bold leading-none">{stats.activeCount}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Catalog Listing Card */}
      <Card className="shadow-sm">
        <CardHeader className="space-y-4">
          <SectionHeader
            title="Formulary Catalog"
            description={`${filteredCatalog.length} catalog entry(s) available`}
          />

          {/* Search and Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[220px] max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search item code, medicine name, generic..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  setPage(1)
                }}
                className="pl-9 h-9 text-sm"
              />
            </div>

            {/* Category Filter - Exact same options as Inventory Page */}
            <select
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value)
                setPage(1)
              }}
              className="h-9 px-3 text-xs bg-background border border-input rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer min-w-[140px]"
            >
              <option value="all">All Categories</option>
              <option value="Analgesics">Analgesics</option>
              <option value="Antibiotics">Antibiotics</option>
              <option value="Antihistamines">Antihistamines</option>
              <option value="First Aid">First Aid</option>
              <option value="Vitamins">Vitamins</option>
              <option value="Gastrointestinal">Gastrointestinal</option>
            </select>

            {/* Classification Filter */}
            <select
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value)
                setPage(1)
              }}
              className="h-9 px-3 text-xs bg-background border border-input rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer min-w-[150px]"
            >
              <option value="all">All Drug Types</option>
              <option value="Over-the-Counter">Over-the-Counter</option>
              <option value="Prescription">Prescription</option>
            </select>

            {(searchQuery || categoryFilter !== "all" || typeFilter !== "all") && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleResetFilters}
                className="h-9 px-2 text-xs text-muted-foreground hover:text-foreground ml-auto flex items-center gap-1"
              >
                <X className="size-3.5" />
                <span>Reset filters</span>
              </Button>
            )}
          </div>
        </CardHeader>

        <CardContent>
          {filteredCatalog.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Pill className="mb-4 size-12 text-muted-foreground" />
              <h3 className="text-lg font-semibold">No catalog entries found</h3>
              <p className="text-sm text-muted-foreground mt-1">
                No items match your selected search or filter conditions.
              </p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[110px]">Item Code</TableHead>
                    <TableHead>Medicine Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Form & Strength</TableHead>
                    <TableHead>Route</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedCatalog.map((item) => (
                    <TableRow
                      key={item.id}
                      onClick={() => setSelectedItem(item)}
                      className="hover:bg-muted/50 cursor-pointer transition-colors"
                    >
                      <TableCell className="font-mono text-xs font-semibold align-middle">
                        {item.item_code}
                      </TableCell>
                      <TableCell className="align-middle">
                        <div className="flex items-center gap-2">
                          <Pill className="size-4 text-primary shrink-0" />
                          <div className="flex flex-col">
                            <span className="font-medium text-foreground">{item.medicine_name}</span>
                            <span className="text-[11px] text-muted-foreground">
                              {item.generic_name} ({item.brand_name})
                            </span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="align-middle">{item.category}</TableCell>
                      <TableCell className="align-middle">
                        <div className="flex flex-col">
                          <span className="text-xs font-medium">{item.strength}</span>
                          <span className="text-[11px] text-muted-foreground">{item.dosage_form}</span>
                        </div>
                      </TableCell>
                      <TableCell className="align-middle text-xs">{item.route}</TableCell>
                      <TableCell className="align-middle">
                        <span
                          className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${item.prescription_type === "Prescription"
                            ? "bg-purple-50 text-purple-700 border-purple-200"
                            : "bg-emerald-50 text-emerald-700 border-emerald-200"
                            }`}
                        >
                          {item.prescription_type === "Prescription" ? "Rx" : "OTC"}
                        </span>
                      </TableCell>
                      <TableCell className="align-middle">
                        <StatusBadge status={getStatusVariant(item.status)}>
                          {item.status}
                        </StatusBadge>
                      </TableCell>
                      <TableCell className="text-right align-middle">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8"
                            onClick={(e) => {
                              e.stopPropagation()
                              setSelectedItem(item)
                            }}
                            title="View Drug Specification"
                          >
                            <Eye className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleOpenEdit(item)
                            }}
                            title="Edit Entry"
                          >
                            <Edit className="size-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <div className="mt-4 pt-2 border-t">
                <Pagination
                  currentPage={safePage}
                  totalPages={totalPages}
                  totalItems={filteredCatalog.length}
                  pageSize={PAGE_SIZE}
                  onPageChange={setPage}
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* View Drug Specification Modal */}
      <Dialog
        open={selectedItem !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedItem(null)
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pill className="size-5 text-primary" />
              <span>Drug Monograph Specification</span>
            </DialogTitle>
          </DialogHeader>

          {selectedItem && (
            <div className="space-y-4 pt-2 text-sm">
              <div className="flex items-center justify-between border-b pb-3">
                <div>
                  <p className="text-xs text-muted-foreground">Item Code</p>
                  <p className="font-mono font-bold text-primary">{selectedItem.item_code}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground mb-1">Status</p>
                  <StatusBadge status={getStatusVariant(selectedItem.status)}>
                    {selectedItem.status}
                  </StatusBadge>
                </div>
              </div>

              <div>
                <p className="text-xs text-muted-foreground">Medicine Name</p>
                <p className="text-base font-bold text-foreground mt-0.5">{selectedItem.medicine_name}</p>
                <p className="text-xs text-muted-foreground">
                  Generic: {selectedItem.generic_name} | Brand: {selectedItem.brand_name}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Active Ingredient</p>
                  <p className="font-medium text-foreground mt-0.5">{selectedItem.active_ingredient}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Category</p>
                  <p className="font-medium text-foreground mt-0.5">{selectedItem.category}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Dosage Form & Strength</p>
                  <p className="font-medium text-foreground mt-0.5">
                    {selectedItem.dosage_form} ({selectedItem.strength})
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Route of Administration</p>
                  <p className="font-medium text-foreground mt-0.5">{selectedItem.route}</p>
                </div>
              </div>

              <div>
                <p className="text-xs text-muted-foreground">Prescription Type</p>
                <p className="font-medium text-foreground mt-0.5">{selectedItem.prescription_type}</p>
              </div>

              {selectedItem.description && (
                <div className="pt-3 border-t">
                  <p className="text-xs text-muted-foreground">Clinical Notes / Description</p>
                  <p className="text-xs bg-muted/40 p-2.5 rounded-md mt-1 text-foreground">
                    {selectedItem.description}
                  </p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Add / Edit Drug Entry Dialog */}
      <Dialog
        open={isAddOpen || editingItem !== null}
        onOpenChange={(open) => {
          if (!open) {
            setIsAddOpen(false)
            setEditingItem(null)
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pill className="size-5 text-primary" />
              <span>{editingItem ? "Edit Catalog Entry" : "Add New Drug Entry"}</span>
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={editingItem ? handleSaveEdit : handleSaveNew} className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Item Code</label>
                <Input
                  required
                  value={formData.item_code}
                  onChange={(e) => setFormData({ ...formData, item_code: e.target.value })}
                  placeholder="MED-PAR-500"
                  className="mt-1 h-9 text-sm font-mono"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">Category</label>
                <select
                  value={formData.category}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      category: e.target.value as CatalogMedicine["category"],
                    })
                  }
                  className="w-full mt-1 h-9 px-3 text-sm bg-background border rounded-md focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="Analgesics">Analgesics</option>
                  <option value="Antibiotics">Antibiotics</option>
                  <option value="Antihistamines">Antihistamines</option>
                  <option value="First Aid">First Aid</option>
                  <option value="Vitamins">Vitamins</option>
                  <option value="Gastrointestinal">Gastrointestinal</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground">Medicine Name (Full Title)</label>
              <Input
                required
                value={formData.medicine_name}
                onChange={(e) => setFormData({ ...formData, medicine_name: e.target.value })}
                placeholder="e.g., Paracetamol 500mg Tablet"
                className="mt-1 h-9 text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Generic Name</label>
                <Input
                  required
                  value={formData.generic_name}
                  onChange={(e) => setFormData({ ...formData, generic_name: e.target.value })}
                  placeholder="e.g., Paracetamol"
                  className="mt-1 h-9 text-sm"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">Brand Name(s)</label>
                <Input
                  required
                  value={formData.brand_name}
                  onChange={(e) => setFormData({ ...formData, brand_name: e.target.value })}
                  placeholder="e.g., Biogesic"
                  className="mt-1 h-9 text-sm"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground">Active Ingredient</label>
              <Input
                required
                value={formData.active_ingredient}
                onChange={(e) => setFormData({ ...formData, active_ingredient: e.target.value })}
                placeholder="e.g., Acetaminophen"
                className="mt-1 h-9 text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Dosage Form</label>
                <Input
                  required
                  value={formData.dosage_form}
                  onChange={(e) => setFormData({ ...formData, dosage_form: e.target.value })}
                  placeholder="Tablet, Capsule, Syrup"
                  className="mt-1 h-9 text-sm"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">Strength</label>
                <Input
                  required
                  value={formData.strength}
                  onChange={(e) => setFormData({ ...formData, strength: e.target.value })}
                  placeholder="500 mg, 10mg/5ml"
                  className="mt-1 h-9 text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Route</label>
                <select
                  value={formData.route}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      route: e.target.value as CatalogMedicine["route"],
                    })
                  }
                  className="w-full mt-1 h-9 px-2 text-sm bg-background border rounded-md"
                >
                  <option value="Oral">Oral</option>
                  <option value="Topical">Topical</option>
                  <option value="Inhalation">Inhalation</option>
                  <option value="Injectable">Injectable</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">Type</label>
                <select
                  value={formData.prescription_type}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      prescription_type: e.target.value as CatalogMedicine["prescription_type"],
                    })
                  }
                  className="w-full mt-1 h-9 px-2 text-sm bg-background border rounded-md"
                >
                  <option value="Over-the-Counter">OTC</option>
                  <option value="Prescription">Prescription</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">Status</label>
                <select
                  value={formData.status}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      status: e.target.value as CatalogMedicine["status"],
                    })
                  }
                  className="w-full mt-1 h-9 px-2 text-sm bg-background border rounded-md"
                >
                  <option value="Active">Active</option>
                  <option value="Under Review">Under Review</option>
                  <option value="Discontinued">Discontinued</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground">Description / Notes</label>
              <Input
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Indication notes..."
                className="mt-1 h-9 text-sm"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsAddOpen(false)
                  setEditingItem(null)
                }}
              >
                Cancel
              </Button>
              <Button type="submit">
                {editingItem ? "Save Changes" : "Create Entry"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}