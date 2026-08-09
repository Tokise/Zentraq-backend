"use client"

import { useState, useEffect, useCallback } from "react"
import { PageHeader } from "@/components/common/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, Phone, Mail, MapPin, Siren } from "lucide-react"
import { toast } from "sonner"
import { getEmergencyContactsAction } from "@/actions/admin/records/resources"

export default function AdminEmergencyContactsPage() {
  const [contacts, setContacts] = useState<Array<{
    id: string
    name: string
    role: string
    phone: string
    email: string | null
    location: string | null
  }>>([])
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getEmergencyContactsAction()
      if (res.error) {
        toast.error(res.error)
        setContacts([])
      } else {
        setContacts(res.contacts)
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to load emergency contacts")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Emergency Contacts"
        description="Important contact information for emergency situations."
      />

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {contacts.map((c) => (
            <Card key={c.id} className="shadow-sm">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <div className="size-9 rounded-full bg-red-50 flex items-center justify-center shrink-0">
                    <Siren className="size-4 text-red-600" />
                  </div>
                  <div>
                    <CardTitle className="text-sm font-semibold">{c.name}</CardTitle>
                    <p className="text-xs text-zinc-400">{c.role}</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-zinc-600">
                  <Phone className="size-3.5 text-zinc-400 shrink-0" />
                  <span className="font-mono">{c.phone}</span>
                </div>
                {c.email && (
                  <div className="flex items-center gap-2 text-zinc-600">
                    <Mail className="size-3.5 text-zinc-400 shrink-0" />
                    <span className="truncate">{c.email}</span>
                  </div>
                )}
                {c.location && (
                  <div className="flex items-center gap-2 text-zinc-600">
                    <MapPin className="size-3.5 text-zinc-400 shrink-0" />
                    <span>{c.location}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}