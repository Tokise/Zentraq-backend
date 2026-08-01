"use client"

import { useState, useEffect, useCallback } from "react"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { Loader2, Save, RefreshCw } from "lucide-react"
import { getSettingsAction, updateSettingsBatchAction, type SettingDTO } from "./actions"

const CATEGORY_LABELS: Record<string, string> = {
  clinic_info: "Clinic Information",
  school_info: "School Information",
  operating_hours: "Operating Hours",
  notification_prefs: "Notification Preferences",
  rfid: "RFID Settings",
  password_policy: "Password Policy",
  security: "Security Settings",
  system: "System Configuration",
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<SettingDTO[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [drafts, setDrafts] = useState<Record<string, any>>({})

  const fetchSettings = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getSettingsAction()
      if (res.error) {
        toast.error(res.error)
      } else {
        setSettings(res.settings)
        const initialDrafts: Record<string, any> = {}
        res.settings.forEach((s) => {
          initialDrafts[s.key] = { ...s.value }
        })
        setDrafts(initialDrafts)
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to load settings")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSettings()
  }, [fetchSettings])

  const groups = settings.reduce<Record<string, SettingDTO[]>>((acc, s) => {
    if (!acc[s.category]) acc[s.category] = []
    acc[s.category].push(s)
    return acc
  }, {})

  function updateDraft(key: string, field: string, value: any) {
    setDrafts((prev) => ({
      ...prev,
      [key]: { ...(prev[key] || {}), [field]: value },
    }))
  }

  async function handleSave() {
    setSaving(true)
    try {
      const entries: Array<{ key: string; value: Record<string, any> }> = []
      settings.forEach((s) => {
        if (drafts[s.key]) {
          const original = JSON.stringify(s.value)
          const draft = JSON.stringify(drafts[s.key])
          if (original !== draft) {
            entries.push({ key: s.key, value: drafts[s.key] })
          }
        }
      })
      if (entries.length === 0) {
        toast.info("No changes to save")
        return
      }
      const res = await updateSettingsBatchAction(entries)
      if (res.error) toast.error(res.error)
      else {
        toast.success(`Saved ${res.updatedCount || entries.length} setting(s)`)
        await fetchSettings()
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to save settings")
    } finally {
      setSaving(false)
    }
  }

  function renderSetting(s: SettingDTO) {
    const value = drafts[s.key] || s.value
    const fields = Object.keys(value || {})

    return (
      <div key={s.key} className="border rounded-lg p-3">
        <h4 className="text-sm font-medium mb-2">{s.key.replace(/_/g, " ")}</h4>
        {s.description && (
          <p className="text-xs text-zinc-500 mb-2">{s.description}</p>
        )}
        <div className="space-y-2">
          {fields.map((field) => {
            const current = value[field]
            return (
              <div key={field} className="flex items-center gap-2">
                <Label className="text-xs w-36 shrink-0">{field.replace(/_/g, " ")}</Label>
                {typeof current === "boolean" ? (
                  <input
                    type="checkbox"
                    checked={current}
                    onChange={(e) => updateDraft(s.key, field, e.target.checked)}
                    className="size-4"
                  />
                ) : typeof current === "number" ? (
                  <Input
                    type="number"
                    value={current}
                    onChange={(e) => updateDraft(s.key, field, parseFloat(e.target.value) || 0)}
                    className="h-8 text-sm flex-1"
                  />
                ) : (
                  <Input
                    value={String(current ?? "")}
                    onChange={(e) => updateDraft(s.key, field, e.target.value)}
                    className="h-8 text-sm flex-1"
                  />
                )}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Admin Settings"
        description="Configure clinic information, operating hours, security, and system preferences."
      />
      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={fetchSettings} disabled={loading} className="h-9 cursor-pointer">
          <RefreshCw className={`size-3.5 mr-1 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
        <Button size="sm" onClick={handleSave} disabled={saving || loading} className="h-9 cursor-pointer">
          <Save className="size-3.5 mr-1" />
          {saving ? "Saving..." : "Save Changes"}
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        Object.entries(groups).map(([category, catSettings]) => (
          <Card key={category} className="shadow-sm">
            <CardHeader className="border-b">
              <h3 className="font-medium text-sm">{CATEGORY_LABELS[category] || category}</h3>
            </CardHeader>
            <CardContent className="p-4 grid gap-3">
              {catSettings.map(renderSetting)}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  )
}