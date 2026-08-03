import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Eye } from "lucide-react"

export default function SettingsPrivacyPage() {
    return (
        <div className="space-y-6">
            <PageHeader
                title="Privacy Settings"
                description="Configure how your sensitive data is displayed."
            />

            <Card>
                <CardHeader>
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <Eye className="size-4 text-muted-foreground" />
                        Sensitive Data Display
                    </CardTitle>
                    <CardDescription className="text-xs">
                        ZenTraq follows a Privacy by Default policy. Sensitive fields are masked until you explicitly reveal them.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-muted-foreground">
                    <p>
                        Sensitive information such as medical records, contact details, and identifiers are hidden by default.
                        Click the eye icon to reveal them temporarily.
                    </p>
                    <p>
                        Sensitive data auto-hides after a period of inactivity (default: 30-60 seconds) or on page navigation.
                    </p>
                    <p>Advanced privacy preferences will be available in a future release.</p>
                </CardContent>
            </Card>
        </div>
    )
}