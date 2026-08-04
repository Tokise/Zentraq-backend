"use client"

import { useState, useEffect, useCallback } from "react"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
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
import { SensitiveField } from "@/components/sensitive-field"
import { Pagination } from "@/components/pagination"
import { toast } from "sonner"
import { Loader2, Search, Archive, KeyRound, RefreshCw, UserPlus, Mail, Building2, Briefcase, Phone, IdCard } from "lucide-react"
import {
    getFacultyAccountsAction,
    createFacultyAccountAction,
    archiveFacultyAccountAction,
    resetFacultyPasswordAction,
    type FacultyAccountDTO,
} from "./actions"

const PAGE_SIZE = 10

export default function FacultyAccountsPage() {
    const [faculty, setFaculty] = useState<FacultyAccountDTO[]>([])
    const [loading, setLoading] = useState(true)
    const [page, setPage] = useState(1)
    const [totalCount, setTotalCount] = useState(0)
    const [searchQuery, setSearchQuery] = useState("")
    const [showCreate, setShowCreate] = useState(false)
    const [resetFaculty, setResetFaculty] = useState<FacultyAccountDTO | null>(null)
    const [newPassword, setNewPassword] = useState("")
    const [selected, setSelected] = useState<FacultyAccountDTO | null>(null)
    const [createForm, setCreateForm] = useState({
        firstName: "", lastName: "", email: "", password: "",
        employeeNumber: "", department: "", position: "", specialization: "",
        clinicLicense: "", phone: "", rfidUid: "",
    })

    const fetchFaculty = useCallback(async () => {
        setLoading(true)
        try {
            const res = await getFacultyAccountsAction({ page, pageSize: PAGE_SIZE, searchQuery })
            if (res.error) {
                toast.error(res.error)
                setFaculty([])
                setTotalCount(0)
            } else {
                setFaculty(res.faculty)
                setTotalCount(res.totalCount)
            }
        } catch (err: any) {
            toast.error(err?.message || "Failed to load faculty accounts")
        } finally {
            setLoading(false)
        }
    }, [page, searchQuery])

    useEffect(() => { fetchFaculty() }, [fetchFaculty])

    const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

    function resetCreateForm() {
        setCreateForm({
            firstName: "", lastName: "", email: "", password: "",
            employeeNumber: "", department: "", position: "", specialization: "",
            clinicLicense: "", phone: "", rfidUid: "",
        })
    }

    async function handleCreate() {
        if (!createForm.firstName.trim() || !createForm.lastName.trim()) {
            toast.error("First name and last name are required")
            return
        }
        if (!createForm.email.trim() || !createForm.password) {
            toast.error("Email and password are required")
            return
        }
        const formData = new FormData()
        Object.entries(createForm).forEach(([key, value]) => formData.set(key, value))
        const res = await createFacultyAccountAction(formData)
        if (res.error) toast.error(res.error)
        else {
            toast.success("Faculty account created")
            setShowCreate(false)
            resetCreateForm()
            fetchFaculty()
        }
    }

    async function handleArchive(id: string) {
        if (!confirm("Archive this faculty account?")) return
        const res = await archiveFacultyAccountAction(id)
        if (res.error) toast.error(res.error)
        else {
            toast.success("Faculty account archived")
            if (selected?.id === id) setSelected(null)
            fetchFaculty()
        }
    }

    async function handleResetPassword() {
        if (!resetFaculty) return
        if (!newPassword || newPassword.length < 12) {
            toast.error("Password must be at least 12 characters")
            return
        }
        const formData = new FormData()
        formData.set("facultyId", resetFaculty.id)
        formData.set("newPassword", newPassword)
        const res = await resetFacultyPasswordAction(formData)
        if (res.error) toast.error(res.error)
        else {
            toast.success("Password reset successfully")
            setResetFaculty(null)
            setNewPassword("")
        }
    }

    return (
        <div className="space-y-6">
            <PageHeader
                title="Faculty Accounts"
                description="Create and manage faculty clinic accounts."
            />

            <div className="flex flex-wrap items-center gap-3">
                <div className="relative flex-1 min-w-[200px] max-w-xs">
                    <Search className="absolute left-2.5 top-2.5 size-4 text-zinc-400" />
                    <Input
                        placeholder="Search faculty..."
                        value={searchQuery}
                        onChange={(e) => { setSearchQuery(e.target.value); setPage(1) }}
                        className="pl-8 h-9 text-sm"
                    />
                </div>
                <Button variant="outline" size="sm" onClick={fetchFaculty} disabled={loading} className="h-9 cursor-pointer">
                    <RefreshCw className={`size-3.5 mr-1 ${loading ? "animate-spin" : ""}`} />
                    Refresh
                </Button>
                <div className="ml-auto">
                    <Button onClick={() => { setShowCreate(true); resetCreateForm() }} className="cursor-pointer">
                        <UserPlus className="size-4 mr-1" /> Add Faculty
                    </Button>
                </div>
            </div>

            <Card className="shadow-sm border-zinc-200/80 bg-white overflow-hidden">
                <CardContent className="p-0">
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="size-5 animate-spin text-muted-foreground" />
                        </div>
                    ) : faculty.length === 0 ? (
                        <div className="py-12 text-center text-sm text-muted-foreground">
                            No faculty accounts found.
                        </div>
                    ) : (
                        <>
                            <Table>
                                <TableHeader>
                                    <TableRow className="hover:bg-transparent">
                                        <TableHead>Name</TableHead>
                                        <TableHead>Email</TableHead>
                                        <TableHead>Employee #</TableHead>
                                        <TableHead>Department</TableHead>
                                        <TableHead>Position</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead className="w-24 text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {faculty.map((member) => (
                                        <TableRow
                                            key={member.id}
                                            className="cursor-pointer"
                                            onClick={() => setSelected(member)}
                                        >
                                            <TableCell>
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <Avatar className="size-9 rounded-full border border-zinc-200 bg-zinc-50 shrink-0">
                                                        <AvatarFallback className="text-xs font-bold bg-zinc-100 text-zinc-500">
                                                            {member.first_name[0]}{member.last_name[0]}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <div className="min-w-0">
                                                        <p className="text-sm font-medium text-zinc-900 truncate">
                                                            {member.first_name} {member.last_name}
                                                        </p>
                                                        <p className="text-xs text-zinc-400 truncate">{member.position || "—"}</p>
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <SensitiveField value={member.email || "—"} fieldType="email" ariaLabel="Email" />
                                            </TableCell>
                                            <TableCell>
                                                <SensitiveField value={member.employee_number || "—"} fieldType="employeeNumber" ariaLabel="Employee number" />
                                            </TableCell>
                                            <TableCell className="text-sm text-zinc-600">{member.department || "—"}</TableCell>
                                            <TableCell className="text-sm text-zinc-600">{member.position || "—"}</TableCell>
                                            <TableCell>
                                                {member.active_status ? (
                                                    <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200">Active</Badge>
                                                ) : (
                                                    <Badge variant="outline" className="text-[10px] bg-zinc-100 text-zinc-500 border-zinc-200">Inactive</Badge>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex justify-end gap-1">
                                                    <Button variant="ghost" size="icon" className="size-8" title="Reset Password"
                                                        onClick={(e) => { e.stopPropagation(); setResetFaculty(member); setNewPassword("") }}>
                                                        <KeyRound className="size-4" />
                                                    </Button>
                                                    <Button variant="ghost" size="icon" className="size-8 text-destructive hover:text-destructive" title="Archive"
                                                        onClick={(e) => { e.stopPropagation(); handleArchive(member.id) }}>
                                                        <Archive className="size-4" />
                                                    </Button>
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

            {/* Faculty Detail Dialog */}
            <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Faculty Details</DialogTitle>
                    </DialogHeader>
                    {selected && (
                        <div className="space-y-4">
                            <div className="flex items-center gap-3">
                                <Avatar className="size-14 rounded-full border border-zinc-200 bg-zinc-50">
                                    <AvatarFallback className="text-base font-bold bg-zinc-100 text-zinc-500">
                                        {selected.first_name[0]}{selected.last_name[0]}
                                    </AvatarFallback>
                                </Avatar>
                                <div>
                                    <h3 className="font-semibold text-sm text-zinc-900">
                                        {selected.first_name} {selected.last_name}
                                    </h3>
                                    <p className="text-xs text-zinc-400">{selected.position || "—"}</p>
                                </div>
                            </div>

                            <div className="text-xs space-y-2 divide-y divide-zinc-100">
                                <div className="flex justify-between py-1.5">
                                    <span className="text-zinc-400 flex items-center gap-1"><Mail className="size-3" /> Email</span>
                                    <SensitiveField value={selected.email || "—"} fieldType="email" ariaLabel="Email" />
                                </div>
                                <div className="flex justify-between py-1.5">
                                    <span className="text-zinc-400 flex items-center gap-1"><IdCard className="size-3" /> Employee #</span>
                                    <SensitiveField value={selected.employee_number || "—"} fieldType="employeeNumber" ariaLabel="Employee number" />
                                </div>
                                <div className="flex justify-between py-1.5">
                                    <span className="text-zinc-400 flex items-center gap-1"><Building2 className="size-3" /> Department</span>
                                    <span className="text-zinc-700">{selected.department || "—"}</span>
                                </div>
                                <div className="flex justify-between py-1.5">
                                    <span className="text-zinc-400 flex items-center gap-1"><Briefcase className="size-3" /> Position</span>
                                    <span className="text-zinc-700">{selected.position || "—"}</span>
                                </div>
                                <div className="flex justify-between py-1.5">
                                    <span className="text-zinc-400 flex items-center gap-1"><Phone className="size-3" /> Phone</span>
                                    <SensitiveField value={selected.phone || "—"} fieldType="phone" ariaLabel="Phone" />
                                </div>
                                <div className="flex justify-between py-1.5">
                                    <span className="text-zinc-400">RFID UID</span>
                                    <SensitiveField value={selected.rfid_uid || "—"} fieldType="rfidUid" ariaLabel="RFID UID" />
                                </div>
                                <div className="flex justify-between py-1.5">
                                    <span className="text-zinc-400">Status</span>
                                    <span className={selected.active_status ? "text-emerald-600" : "text-zinc-400"}>
                                        {selected.active_status ? "Active" : "Inactive"}
                                    </span>
                                </div>
                            </div>

                            <div className="flex gap-2 pt-2 border-t border-zinc-100">
                                <Button variant="outline" size="sm" className="flex-1 text-xs"
                                    onClick={() => { setResetFaculty(selected); setNewPassword("") }}>
                                    <KeyRound className="size-3.5 mr-1.5" /> Reset Password
                                </Button>
                                <Button variant="outline" size="sm" className="flex-1 text-xs text-destructive hover:text-destructive"
                                    onClick={() => handleArchive(selected.id)}>
                                    <Archive className="size-3.5 mr-1.5" /> Archive
                                </Button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* Create Faculty Dialog */}
            <Dialog open={showCreate} onOpenChange={setShowCreate}>
                <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Create Faculty Account</DialogTitle>
                    </DialogHeader>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <Label className="text-xs">First Name *</Label>
                            <Input value={createForm.firstName} onChange={(e) => setCreateForm((f) => ({ ...f, firstName: e.target.value }))} className="h-9" />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs">Last Name *</Label>
                            <Input value={createForm.lastName} onChange={(e) => setCreateForm((f) => ({ ...f, lastName: e.target.value }))} className="h-9" />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs">Email *</Label>
                            <Input type="email" value={createForm.email} onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))} className="h-9" />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs">Temporary Password *</Label>
                            <Input type="password" value={createForm.password} onChange={(e) => setCreateForm((f) => ({ ...f, password: e.target.value }))} placeholder="Min 12 chars" className="h-9" />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs">Employee Number</Label>
                            <Input value={createForm.employeeNumber} onChange={(e) => setCreateForm((f) => ({ ...f, employeeNumber: e.target.value }))} className="h-9" />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs">Department</Label>
                            <Input value={createForm.department} onChange={(e) => setCreateForm((f) => ({ ...f, department: e.target.value }))} className="h-9" />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs">Position</Label>
                            <Input value={createForm.position} onChange={(e) => setCreateForm((f) => ({ ...f, position: e.target.value }))} className="h-9" />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs">Specialization</Label>
                            <Input value={createForm.specialization} onChange={(e) => setCreateForm((f) => ({ ...f, specialization: e.target.value }))} className="h-9" />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs">Clinic License</Label>
                            <Input value={createForm.clinicLicense} onChange={(e) => setCreateForm((f) => ({ ...f, clinicLicense: e.target.value }))} className="h-9" />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs">Phone</Label>
                            <Input value={createForm.phone} onChange={(e) => setCreateForm((f) => ({ ...f, phone: e.target.value }))} className="h-9" />
                        </div>
                        <div className="space-y-1.5 col-span-2">
                            <Label className="text-xs">RFID UID</Label>
                            <Input value={createForm.rfidUid} onChange={(e) => setCreateForm((f) => ({ ...f, rfidUid: e.target.value }))} placeholder="Optional" className="h-9" />
                        </div>
                    </div>
                    <DialogFooter className="gap-2">
                        <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
                        <Button onClick={handleCreate}>Create Account</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Reset Password Dialog */}
            <Dialog open={!!resetFaculty} onOpenChange={() => setResetFaculty(null)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Reset Password</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="rounded-md border p-3 bg-muted/30">
                            <p className="text-xs text-muted-foreground">Faculty Member</p>
                            <p className="text-sm font-semibold">
                                {resetFaculty?.first_name} {resetFaculty?.last_name} ({resetFaculty?.email || "no email"})
                            </p>
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs">New Password (min 12 characters)</Label>
                            <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="h-9" />
                        </div>
                    </div>
                    <DialogFooter className="gap-2">
                        <Button variant="outline" onClick={() => setResetFaculty(null)}>Cancel</Button>
                        <Button onClick={handleResetPassword}>Reset Password</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}