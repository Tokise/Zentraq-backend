"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Pill, AlertTriangle, Package, Calendar } from "lucide-react"
import { getMedicineStock, type Prescription, type MedicineStock } from "@/app/actions/prescriptions"
import { toast } from "sonner"

interface DispensingFormProps {
  prescription: Prescription
  onDispense: (stockId: string, quantity: number) => Promise<void>
}

export function DispensingForm({ prescription, onDispense }: DispensingFormProps) {
  const [stocks, setStocks] = useState<MedicineStock[]>([])
  const [selectedStock, setSelectedStock] = useState<MedicineStock | null>(null)
  const [quantity, setQuantity] = useState("")
  const [loading, setLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    const loadStock = async () => {
      setLoading(true)
      const result = await getMedicineStock(prescription.medicine_id)
      if (result.error) {
        toast.error(result.error)
      } else {
        setStocks(result.stock)
      }
      setLoading(false)
    }

    loadStock()
  }, [prescription.medicine_id])

  const handleDispense = async () => {
    if (!selectedStock) {
      toast.error("Please select a stock batch")
      return
    }

    const qty = parseInt(quantity)
    if (!qty || qty <= 0) {
      toast.error("Please enter a valid quantity")
      return
    }

    if (qty > selectedStock.quantity) {
      toast.error("Insufficient stock in selected batch")
      return
    }

    setIsSubmitting(true)
    try {
      await onDispense(selectedStock.id, qty)
      toast.success("Medicine dispensed successfully")
    } catch (error) {
      toast.error("Failed to dispense medicine")
    } finally {
      setIsSubmitting(false)
    }
  }

  const isExpiringSoon = (date: string | null) => {
    if (!date) return false
    const expiry = new Date(date)
    const now = new Date()
    const daysUntilExpiry = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    return daysUntilExpiry <= 30
  }

  const formatDate = (date: string | null) => {
    if (!date) return "N/A"
    return new Date(date).toLocaleDateString()
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Dispense Medicine</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="text-center text-sm text-muted-foreground py-4">
            Loading stock information...
          </div>
        ) : stocks.length === 0 ? (
          <div className="text-center text-sm text-muted-foreground py-4">
            No stock available for this medicine
          </div>
        ) : (
          <>
            <div>
              <Label>Select Stock Batch *</Label>
              <div className="space-y-2 mt-2">
                {stocks.map((stock) => (
                  <div
                    key={stock.id}
                    className={`border rounded-lg p-3 cursor-pointer transition-colors hover:bg-accent ${
                      selectedStock?.id === stock.id ? "bg-accent border-primary" : ""
                    }`}
                    onClick={() => setSelectedStock(stock)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Package className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">Batch: {stock.batch_number || "N/A"}</span>
                        </div>
                        <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                          <span>Qty: {stock.quantity}</span>
                          {stock.expiry_date && (
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              <span className={isExpiringSoon(stock.expiry_date) ? "text-amber-600" : ""}>
                                {formatDate(stock.expiry_date)}
                              </span>
                              {isExpiringSoon(stock.expiry_date) && (
                                <Badge variant="outline" className="text-amber-600 border-amber-600">
                                  Expiring Soon
                                </Badge>
                              )}
                            </div>
                          )}
                        </div>
                        {stock.location && (
                          <div className="text-xs text-muted-foreground mt-1">
                            Location: {stock.location}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <Label htmlFor="quantity">Quantity to Dispense *</Label>
              <Input
                id="quantity"
                type="number"
                min="1"
                max={selectedStock?.quantity || 0}
                placeholder={`Max: ${selectedStock?.quantity || 0}`}
                value={quantity}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQuantity(e.target.value)}
              />
            </div>

            {prescription.dosage && (
              <div className="bg-muted p-3 rounded-lg">
                <p className="text-sm">
                  <span className="font-medium">Prescribed Dosage:</span> {prescription.dosage}
                </p>
                {prescription.frequency && (
                  <p className="text-sm mt-1">
                    <span className="font-medium">Frequency:</span> {prescription.frequency}
                  </p>
                )}
              </div>
            )}

            {prescription.instructions && (
              <div className="bg-muted p-3 rounded-lg">
                <p className="text-sm">
                  <span className="font-medium">Instructions:</span> {prescription.instructions}
                </p>
              </div>
            )}

            <Button onClick={handleDispense} disabled={isSubmitting} className="w-full">
              {isSubmitting ? "Dispensing..." : "Dispense Medicine"}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  )
}
