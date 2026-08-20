import Link from "next/link"
import { buttonVariants } from "@/components/ui/button"
import { ShieldX } from "lucide-react"

export default function UnauthorizedPage() {
    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-background p-6">
            <div className="flex flex-col items-center text-center max-w-md">
                <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                    <ShieldX className="size-6" />
                </div>
                <h1 className="mb-2 text-xl font-semibold">Access Denied</h1>
                <p className="mb-6 text-sm text-muted-foreground">
                    You don't have permission to access this page. Please contact an administrator if you believe this is a mistake.
                </p>
                <Link
                    href="/"
                    className={buttonVariants({ variant: "default" })}
                >
                    Go to Dashboard
                </Link>
            </div>
        </div>
    )
}