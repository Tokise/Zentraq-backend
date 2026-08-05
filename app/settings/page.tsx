import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { User, Shield, Eye, PenLine } from "lucide-react"
import Link from "next/link"

export default function SettingsPage() {
    return (
        <div className="space-y-6">
            <PageHeader
                title="Settings"
                description="Manage your profile, privacy preferences, and security options."
            />

            <div className="grid gap-4 sm:grid-cols-1 lg:grid-cols-3">
                <Link href="/settings/profile" className="block">
                    <Card className="hover:border-primary/40 transition-colors cursor-pointer">
                        <CardHeader>
                            <div className="mb-2 flex size-10 items-center justify-center border border-primary/20 bg-primary-soft text-primary">
                                <User className="size-5" />
                            </div>
                            <CardTitle className="text-sm font-semibold">Profile</CardTitle>
                            <CardDescription className="text-xs">
                                Update your name, photo, and contact details.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <span className="text-xs text-primary flex items-center gap-1">
                                <PenLine className="size-3" /> Edit profile
                            </span>
                        </CardContent>
                    </Card>
                </Link>

                <Link href="/settings/privacy" className="block">
                    <Card className="hover:border-primary/40 transition-colors cursor-pointer">
                        <CardHeader>
                            <div className="mb-2 flex size-10 items-center justify-center border border-primary/20 bg-primary-soft text-primary">
                                <Eye className="size-5" />
                            </div>
                            <CardTitle className="text-sm font-semibold">Privacy</CardTitle>
                            <CardDescription className="text-xs">
                                Configure sensitive data display preferences.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <span className="text-xs text-primary flex items-center gap-1">
                                <PenLine className="size-3" /> Manage privacy
                            </span>
                        </CardContent>
                    </Card>
                </Link>

                <Link href="/settings/security" className="block">
                    <Card className="hover:border-primary/40 transition-colors cursor-pointer">
                        <CardHeader>
                            <div className="mb-2 flex size-10 items-center justify-center border border-success/20 bg-success/10 text-success">
                                <Shield className="size-5" />
                            </div>
                            <CardTitle className="text-sm font-semibold">Security</CardTitle>
                            <CardDescription className="text-xs">
                                Change password and manage sessions.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <span className="text-xs text-primary flex items-center gap-1">
                                <PenLine className="size-3" /> Manage security
                            </span>
                        </CardContent>
                    </Card>
                </Link>
            </div>
        </div>
    )
}