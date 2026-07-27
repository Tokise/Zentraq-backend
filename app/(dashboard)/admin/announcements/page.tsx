"use client"

import { useState, useEffect } from "react"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createClient } from "@/utils/supabase/client"
import { toast } from "sonner"
import { Loader2, Plus, Pencil, Trash2, X, Check } from "lucide-react"
import { Badge } from "@/components/ui/badge"

export default function AdminAnnouncementsPage() {
    const supabase = createClient()
    const [announcements, setAnnouncements] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [showForm, setShowForm] = useState(false)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [submitting, setSubmitting] = useState(false)
    const [form, setForm] = useState({ title: "", content: "" })

    async function fetchAnnouncements() {
        const { data } = await supabase
            .from("announcements")
            .select("*, profiles:posted_by(email, full_name)")
            .order("created_at", { ascending: false })

        setAnnouncements(data || [])
        setLoading(false)
    }

    useEffect(() => {
        fetchAnnouncements()
    }, [supabase])

    function resetForm() {
        setForm({ title: "", content: "" })
        setEditingId(null)
        setShowForm(false)
    }

    function startEdit(ann: any) {
        setForm({ title: ann.title, content: ann.content })
        setEditingId(ann.id)
        setShowForm(true)
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        if (!form.title.trim() || !form.content.trim()) {
            toast.error("Title and content are required")
            return
        }

        setSubmitting(true)
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) throw new Error("Not authenticated")

            if (editingId) {
                const { error } = await supabase
                    .from("announcements")
                    .update({
                        title: form.title.trim(),
                        content: form.content.trim(),
                        updated_at: new Date().toISOString(),
                    })
                    .eq("id", editingId)

                if (error) throw error
                toast.success("Announcement updated!")
            } else {
                const { error } = await supabase.from("announcements").insert({
                    title: form.title.trim(),
                    content: form.content.trim(),
                    posted_by: user.id,
                })

                if (error) throw error
                toast.success("Announcement posted!")
            }

            resetForm()
            await fetchAnnouncements()
        } catch (err: any) {
            toast.error(err.message || "Failed to save announcement")
        } finally {
            setSubmitting(false)
        }
    }

    async function handleDelete(id: string) {
        if (!confirm("Delete this announcement?")) return

        try {
            const { error } = await supabase.from("announcements").delete().eq("id", id)
            if (error) throw error
            toast.success("Announcement deleted")
            await fetchAnnouncements()
        } catch (err: any) {
            toast.error(err.message || "Failed to delete")
        }
    }

    return (
        <div className="space-y-6 max-w-3xl mx-auto">
            <PageHeader title="Announcements" description="Create and manage clinic announcements">
                <Button size="sm" onClick={() => { resetForm(); setShowForm(!showForm) }} className="cursor-pointer">
                    {showForm ? <X className="size-3.5 mr-1" /> : <Plus className="size-3.5 mr-1" />}
                    {showForm ? "Cancel" : "New Announcement"}
                </Button>
            </PageHeader>

            {showForm && (
                <Card className="shadow-sm border-zinc-200/80">
                    <CardHeader>
                        <CardTitle className="text-base">{editingId ? "Edit Announcement" : "New Announcement"}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="space-y-1.5">
                                <Label className="text-xs">Title</Label>
                                <Input
                                    value={form.title}
                                    onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                                    placeholder="Announcement title"
                                    required
                                    className="h-9"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs">Content</Label>
                                <textarea
                                    value={form.content}
                                    onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
                                    placeholder="Write your announcement here..."
                                    rows={5}
                                    required
                                    className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/10 resize-none"
                                />
                            </div>
                            <div className="flex gap-2">
                                <Button
                                    type="submit"
                                    disabled={submitting}
                                    className="bg-zinc-900 text-white hover:bg-zinc-800 cursor-pointer"
                                >
                                    {submitting ? (
                                        <><Loader2 className="size-3.5 animate-spin mr-1" /> Saving...</>
                                    ) : editingId ? (
                                        <><Check className="size-3.5 mr-1" /> Update</>
                                    ) : (
                                        <><Check className="size-3.5 mr-1" /> Post</>
                                    )}
                                </Button>
                                <Button type="button" variant="outline" onClick={resetForm} className="cursor-pointer">
                                    Cancel
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            )}

            {loading ? (
                <div className="space-y-4">
                    {[1, 2, 3].map((i) => (
                        <Card key={i} className="animate-pulse">
                            <CardContent className="p-5">
                                <div className="h-4 w-48 bg-zinc-100 rounded mb-3" />
                                <div className="h-3 w-full bg-zinc-100 rounded mb-2" />
                                <div className="h-3 w-3/4 bg-zinc-100 rounded" />
                            </CardContent>
                        </Card>
                    ))}
                </div>
            ) : announcements.length === 0 ? (
                <Card>
                    <CardContent className="py-12 text-center">
                        <p className="text-sm text-muted-foreground">No announcements yet</p>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-4">
                    {announcements.map((ann) => (
                        <Card key={ann.id} className="shadow-sm">
                            <CardHeader className="pb-2">
                                <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                        <CardTitle className="text-base">{ann.title}</CardTitle>
                                        <p className="text-xs text-muted-foreground mt-0.5">
                                            Posted {ann.created_at ? new Date(ann.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }) : ""}
                                            {ann.profiles?.full_name ? ` by ${ann.profiles.full_name}` : ""}
                                        </p>
                                    </div>
                                    <div className="flex gap-1 shrink-0 ml-4">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => startEdit(ann)}
                                            className="size-8 text-muted-foreground cursor-pointer"
                                        >
                                            <Pencil className="size-3.5" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => handleDelete(ann.id)}
                                            className="size-8 text-red-500 hover:text-red-700 hover:bg-red-50 cursor-pointer"
                                        >
                                            <Trash2 className="size-3.5" />
                                        </Button>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <p className="text-sm whitespace-pre-wrap">{ann.content}</p>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    )
}