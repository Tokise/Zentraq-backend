"use client"

import { useState, useEffect } from "react"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { createClient } from "@/utils/supabase/client"
import { toast } from "sonner"
import { Loader2, ShieldCheck } from "lucide-react"
import { PasswordStrengthInput } from "@/components/password-strength-input"
import { checkPassword } from "@/lib/validation/password"

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

        const { valid, missing } = checkPassword(password)
        if (!valid) {
            toast.error(`Password needs: ${missing.join(", ")}`)
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

    const passwordsMatch = confirmPassword.length > 0 && password === confirmPassword
    const passwordsMismatch = confirmPassword.length > 0 && password !== confirmPassword

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
                    <CardTitle className="text-base flex items-center gap-1.5">
                        <ShieldCheck className="size-4 text-zinc-400" />
                        Change Password
                    </CardTitle>
                    <CardDescription>Update your account password</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleChangePassword} className="space-y-4">
                        <PasswordStrengthInput
                            label="New Password"
                            id="new-password"
                            value={password}
                            onChange={setPassword}
                            placeholder="Enter a new password"
                        />

                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-zinc-700" htmlFor="confirm-password">
                                Confirm Password
                            </label>
                            <input
                                id="confirm-password"
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                placeholder="Re-enter new password"
                                autoComplete="new-password"
                                required
                                className={`w-full h-9 px-3 rounded-md border bg-white text-sm focus:outline-none focus:ring-2 ${passwordsMismatch
                                        ? "border-red-300 focus:ring-red-400/20"
                                        : passwordsMatch
                                            ? "border-emerald-300 focus:ring-emerald-400/20"
                                            : "border-zinc-200 focus:ring-zinc-900/10"
                                    }`}
                            />
                            {passwordsMismatch && (
                                <p className="text-[11px] text-red-500">Passwords do not match</p>
                            )}
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