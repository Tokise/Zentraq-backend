"use client"

import { useState, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Search, Pill, AlertTriangle } from "lucide-react"
import { getMedicineCatalog, type Medicine } from "@/actions/clinical/prescriptions"
import { toast } from "sonner"

interface MedicineSelectorProps {
  onSelect: (medicine: Medicine) => void
  selectedId?: string
}

export function MedicineSelector({ onSelect, selectedId }: MedicineSelectorProps) {
  const [search, setSearch] = useState("")
  const [medicines, setMedicines] = useState<Medicine[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const loadMedicines = async () => {
      setLoading(true)
      const result = await getMedicineCatalog({ search: search || undefined })
      if (result.error) {
        toast.error(result.error)
      } else {
        setMedicines(result.medicines)
      }
      setLoading(false)
    }

    const debounceTimer = setTimeout(loadMedicines, 300)
    return () => clearTimeout(debounceTimer)
  }, [search])

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search medicines..."
          value={search}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {loading ? (
        <div className="text-center text-sm text-muted-foreground py-4">
          Loading medicines...
        </div>
      ) : medicines.length === 0 ? (
        <div className="text-center text-sm text-muted-foreground py-4">
          No medicines found
        </div>
      ) : (
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {medicines.map((medicine) => (
            <Card
              key={medicine.id}
              className={`cursor-pointer transition-colors hover:bg-accent ${
                selectedId === medicine.id ? "bg-accent border-primary" : ""
              }`}
              onClick={() => onSelect(medicine)}
            >
              <CardContent className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Pill className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{medicine.generic_name}</span>
                      {medicine.brand_name && (
                        <span className="text-sm text-muted-foreground">
                          ({medicine.brand_name})
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                      {medicine.category && <Badge variant="outline">{medicine.category}</Badge>}
                      <span>{medicine.unit}</span>
                    </div>
                  </div>
                  {medicine.is_controlled && (
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
