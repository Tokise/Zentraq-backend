import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Shield, KeyRound } from "lucide-react"

export default function SettingsSecurityPage() {
    return (
        <div className="space-y-6">
            <PageHeader
                title="Security Settings"
                description="Manage your password and active sessions."
            />

            <Card>
                <CardHeader>
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <KeyRound className="size-4 text-muted-foreground" />
                        Change Password
                    </CardTitle>
                    <CardDescription className="text-xs">
                        Update your account password. Password changes will log you out of all other sessions.
                    </CardDescription>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                    Password management will be available in a future release.
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <Shield className="size-4 text-muted-foreground" />
                        Active Sessions
                    </CardTitle>
                    <CardDescription className="text-xs">
                        ZenTraq enforces one-device login. Only your most recent session is active.
                    </CardDescription>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                    Session management will be available in a future release.
                </CardContent>
            </Card>
        </div>
    )
}