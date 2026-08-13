"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Loader2, Scan } from "lucide-react"
import { toast } from "sonner"
import { searchRecordsAction, type RecordSearchResult } from "@/actions/clinical/records/search"

type RfidSearchButtonProps = {
  onResults: (results: RecordSearchResult[]) => void
  placeholder?: string
}

export function RfidSearchButton({ onResults, placeholder = "Scan RFID or enter ID" }: RfidSearchButtonProps) {
  const [open, setOpen] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [value, setValue] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  async function handleScan() {
    const uid = value.trim()
    if (!uid || scanning) return

    setScanning(true)
    try {
      const res = await searchRecordsAction(uid)
      if (res.error) {
        toast.error(res.error)
        onResults([])
      } else {
        const combined = [...res.students, ...res.faculty]
        onResults(combined)
        setOpen(false)
        setValue("")
      }
    } finally {
      setScanning(false)
    }
  }

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)} className="cursor-pointer">
        <Scan className="size-3.5 mr-1" />
        RFID Scan
      </Button>
    )
  }

  return (
    <div className="flex gap-2">
      <Input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && handleScan()}
        placeholder={placeholder}
        className="h-9"
      />
      <Button onClick={handleScan} disabled={scanning || !value.trim()} className="shrink-0 cursor-pointer">
        {scanning ? <Loader2 className="size-3.5 animate-spin mr-1" /> : <Scan className="size-3.5 mr-1" />}
        {scanning ? "Scanning" : "Search"}
      </Button>
      <Button variant="ghost" size="sm" onClick={() => { setOpen(false); setValue("") }} className="cursor-pointer">
        Cancel
      </Button>
    </div>
  )
}