"use client"

import { useState, useEffect } from "react"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { createClient } from "@/utils/supabase/client"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"

export default function StudentSettingsPage() {
    const supabase = createClient()
    const [profile, setProfile] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [changingPassword, setChangingPassword] = useState(false)
    const [password, setPassword] = useState("")
    const [confirmPassword, setConfirmPassword] = useState("")

    useEffect(() => {
        async function load() {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            const { data } = await supabase
                .from("student_accounts")
                .select("*")
                .eq("user_id", user.id)
                .maybeSingle()

            setProfile(data)
            setLoading(false)
        }
        load()
    }, [supabase])

    async function handleChangePassword(e: React.FormEvent) {
        e.preventDefault()
        if (password.length < 8) {
            toast.error("Password must be at least 8 characters")
            return
        }
        if (password !== confirmPassword) {
            toast.error("Passwords do not match")
            return
        }

        setChangingPassword(true)
        try {
            const { error } = await supabase.auth.updateUser({ password })
            if (error) throw error
            toast.success("Password updated successfully")
            setPassword("")
            setConfirmPassword("")
        } catch (err: any) {
            toast.error(err.message || "Failed to update password")
        } finally {
            setChangingPassword(false)
        }
    }

    return (
        <div className="space-y-6 max-w-xl mx-auto">
            <PageHeader title="Settings" description="Manage your account settings" />

            <Card className="shadow-sm">
                <CardHeader>
                    <CardTitle className="text-base">Profile Information</CardTitle>
                    <CardDescription>Your clinic profile details</CardDescription>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="h-20 flex items-center justify-center">
                            <Loader2 className="size-5 animate-spin text-muted-foreground" />
                        </div>
                    ) : profile ? (
                        <div className="text-sm space-y-3">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-xs text-muted-foreground">First Name</p>
                                    <p className="font-medium">{profile.first_name}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-muted-foreground">Last Name</p>
                                    <p className="font-medium">{profile.last_name}</p>
                                </div>
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground">Student / Employee ID</p>
                                <p className="font-medium">{profile.student_number || profile.employee_number || "N/A"}</p>
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground">Email</p>
                                <p className="font-medium">{profile.email || "N/A"}</p>
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground">Department</p>
                                <p className="font-medium">{profile.department || "N/A"}</p>
                            </div>
                            {profile.course && (
                                <div>
                                    <p className="text-xs text-muted-foreground">Course</p>
                                    <p className="font-medium">{profile.course}</p>
                                </div>
                            )}
                        </div>
                    ) : (
                        <p className="text-sm text-muted-foreground">No profile data</p>
                    )}
                </CardContent>
            </Card>

            <Card className="shadow-sm">
                <CardHeader>
                    <CardTitle className="text-base">Change Password</CardTitle>
                    <CardDescription>Update your account password</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleChangePassword} className="space-y-4">
                        <div className="space-y-1.5">
                            <Label className="text-xs">New Password</Label>
                            <Input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Minimum 8 characters"
                                minLength={8}
                                required
                                className="h-9"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs">Confirm Password</Label>
                            <Input
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                placeholder="Re-enter new password"
                                minLength={8}
                                required
                                className="h-9"
                            />
                        </div>
                        <Button
                            type="submit"
                            disabled={changingPassword}
                            className="bg-zinc-900 text-white hover:bg-zinc-800 cursor-pointer"
                        >
                            {changingPassword ? (
                                <><Loader2 className="size-3.5 animate-spin mr-1" /> Updating...</>
                            ) : (
                                "Change Password"
                            )}
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    )
}