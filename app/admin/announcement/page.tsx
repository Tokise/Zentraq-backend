"use client"

import { useState, useEffect, useRef } from "react"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import {
    getAnnouncementsAction,
    createAnnouncement,
    updateAnnouncement,
    deleteAnnouncement,
    uploadAnnouncementImageAction,
    type AnnouncementDTO,
} from "@/actions/admin/clinic-announcements"
import { Loader2, Plus, Pencil, Trash2, X, Check, ImagePlus, ImageOff } from "lucide-react"

import { useSearchParams } from "next/navigation"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"

export default function AdminClinicAnnouncementsPage() {
    const searchParams = useSearchParams()
    const targetId = searchParams.get("id")

    const [announcements, setAnnouncements] = useState<AnnouncementDTO[]>([])
    const [loading, setLoading] = useState(true)
    const [showForm, setShowForm] = useState(false)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [submitting, setSubmitting] = useState(false)
    const [form, setForm] = useState({ title: "", content: "" })
    const [selectedAnnModal, setSelectedAnnModal] = useState<AnnouncementDTO | null>(null)

    // Image handling
    const [imageFile, setImageFile] = useState<File | null>(null)
    const [imagePreview, setImagePreview] = useState<string | null>(null)
    const [existingImageUrl, setExistingImageUrl] = useState<string | null>(null)
    const [removeExistingImage, setRemoveExistingImage] = useState(false)
    const [dragActive, setDragActive] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)

    async function fetchAnnouncements() {
        const res = await getAnnouncementsAction()
        if (res.error) {
            toast.error(res.error)
            setAnnouncements([])
        } else {
            setAnnouncements(res.announcements)
        }
        setLoading(false)
    }

    useEffect(() => {
        fetchAnnouncements()
    }, [])

    // Auto-pop up targeted announcement detail modal when ?id= parameter is present
    useEffect(() => {
        if (targetId && announcements.length > 0) {
            const match = announcements.find((a) => a.id === targetId)
            if (match) {
                setSelectedAnnModal(match)
            }
        }
    }, [targetId, announcements])

    function resetForm() {
        setForm({ title: "", content: "" })
        setEditingId(null)
        setShowForm(false)
        setImageFile(null)
        setImagePreview(null)
        setExistingImageUrl(null)
        setRemoveExistingImage(false)
    }

    function startEdit(ann: AnnouncementDTO) {
        setForm({ title: ann.title, content: ann.content })
        setEditingId(ann.id)
        setExistingImageUrl(ann.image_url || null)
        setImageFile(null)
        setImagePreview(null)
        setRemoveExistingImage(false)
        setShowForm(true)
    }

    function handleFileSelect(file: File | null) {
        if (!file) return
        if (!file.type.startsWith("image/")) {
            toast.error("Please select an image file")
            return
        }
        if (file.size > 5 * 1024 * 1024) {
            toast.error("Image must be under 5MB")
            return
        }
        setImageFile(file)
        setRemoveExistingImage(false)
        const reader = new FileReader()
        reader.onload = () => setImagePreview(reader.result as string)
        reader.readAsDataURL(file)
    }

    function handleDrop(e: React.DragEvent) {
        e.preventDefault()
        setDragActive(false)
        handleFileSelect(e.dataTransfer.files?.[0] || null)
    }

    function clearImage() {
        setImageFile(null)
        setImagePreview(null)
        if (existingImageUrl) setRemoveExistingImage(true)
        if (fileInputRef.current) fileInputRef.current.value = ""
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        if (!form.title.trim() || !form.content.trim()) {
            toast.error("Title and content are required")
            return
        }

        setSubmitting(true)
        try {
            // Upload image via Server Action if a new file was selected
            let imageUrlToSave: string | null | undefined = undefined
            if (imageFile && imagePreview) {
                const uploadRes = await uploadAnnouncementImageAction(imagePreview)
                if (uploadRes.error) {
                    toast.error(uploadRes.error)
                    return
                }
                imageUrlToSave = uploadRes.url
            } else if (removeExistingImage) {
                imageUrlToSave = null
            }

            if (editingId) {
                const result = await updateAnnouncement(editingId, form.title.trim(), form.content.trim(), imageUrlToSave)
                if (result.error) {
                    toast.error(result.error)
                    return
                }
                toast.success("Announcement updated!")
            } else {
                const result = await createAnnouncement(form.title.trim(), form.content.trim(), imageUrlToSave)
                if (result.error) {
                    toast.error(result.error)
                    return
                }
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

        const result = await deleteAnnouncement(id)
        if (result.error) {
            toast.error(result.error)
            return
        }
        toast.success("Announcement deleted")
        await fetchAnnouncements()
    }

    const displayedPreview = imagePreview || (!removeExistingImage ? existingImageUrl : null)

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

                            <div className="space-y-1.5">
                                <Label className="text-xs">Image (optional)</Label>

                                {displayedPreview ? (
                                    <div className="relative rounded-lg border border-zinc-200 overflow-hidden bg-zinc-50/50 p-1">
                                        <img src={displayedPreview} alt="Preview" className="w-full h-auto max-h-[500px] object-contain rounded-md block mx-auto" />
                                        <button
                                            type="button"
                                            onClick={clearImage}
                                            className="absolute top-2 right-2 size-7 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center cursor-pointer shadow-md"
                                        >
                                            <X className="size-3.5" />
                                        </button>
                                    </div>
                                ) : (
                                    <label
                                        onDragOver={(e) => { e.preventDefault(); setDragActive(true) }}
                                        onDragLeave={() => setDragActive(false)}
                                        onDrop={handleDrop}
                                        className={`flex flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed py-8 cursor-pointer transition-colors ${dragActive ? "border-zinc-400 bg-zinc-50" : "border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50/50"
                                            }`}
                                    >
                                        <ImagePlus className="size-5 text-zinc-400" />
                                        <span className="text-xs text-zinc-500">Click to upload or drag an image here</span>
                                        <span className="text-[10px] text-zinc-350">PNG, JPG up to 5MB</span>
                                        <input
                                            ref={fileInputRef}
                                            type="file"
                                            accept="image/*"
                                            className="hidden"
                                            onChange={(e) => handleFileSelect(e.target.files?.[0] || null)}
                                        />
                                    </label>
                                )}
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

            {!showForm && (
                loading ? (
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
                            <ImageOff className="size-6 text-zinc-300 mx-auto mb-2" />
                            <p className="text-sm text-muted-foreground">No announcements yet</p>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="space-y-6">
                        {announcements.map((ann) => (
                            <div key={ann.id} className="space-y-3">
                                {/* Card for text content ON TOP */}
                                <Card className="shadow-sm">
                                    <CardHeader className="pb-2">
                                        <div className="flex items-start justify-between">
                                            <div className="flex-1 min-w-0">
                                                <CardTitle className="text-base font-semibold">{ann.title}</CardTitle>
                                                <p className="text-xs text-muted-foreground mt-0.5">
                                                    Posted {ann.created_at ? new Date(ann.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }) : ""}
                                                    {ann.poster_name ? ` by ${ann.poster_name}` : ""}
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
                                        <p className="text-sm whitespace-pre-wrap leading-relaxed">{ann.content}</p>
                                    </CardContent>
                                </Card>

                                {/* Full-length picture standalone below the text card */}
                                {ann.image_url && (
                                    <div className="w-full overflow-hidden rounded-xl border border-border/80 bg-muted/20 p-1 shadow-sm">
                                        <img
                                            src={ann.image_url}
                                            alt={ann.title}
                                            className="w-full h-auto object-contain rounded-lg"
                                        />
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )
            )}

            {/* Targeted Announcement Detail Pop-up Dialog */}
            {selectedAnnModal && (
                <Dialog open={!!selectedAnnModal} onOpenChange={() => setSelectedAnnModal(null)}>
                    <DialogContent className="sm:max-w-xl">
                        <DialogHeader>
                            <DialogTitle className="text-base font-semibold">{selectedAnnModal.title}</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-3 py-2">
                            <p className="text-xs text-muted-foreground">
                                Posted {selectedAnnModal.created_at ? new Date(selectedAnnModal.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : ""}
                                {selectedAnnModal.poster_name ? ` by ${selectedAnnModal.poster_name}` : ""}
                            </p>
                            <p className="text-sm whitespace-pre-wrap leading-relaxed text-foreground">{selectedAnnModal.content}</p>
                            {selectedAnnModal.image_url && (
                                <div className="w-full overflow-hidden rounded-xl border border-border/80 bg-muted/20 p-1 mt-2">
                                    <img
                                        src={selectedAnnModal.image_url}
                                        alt={selectedAnnModal.title}
                                        className="w-full h-auto object-contain rounded-lg"
                                    />
                                </div>
                            )}
                        </div>
                    </DialogContent>
                </Dialog>
            )}
        </div>
    )
}