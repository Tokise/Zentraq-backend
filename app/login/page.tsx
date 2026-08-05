"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { login } from "@/actions/system/login"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { toast } from "sonner"
import { CheckCircle2, Eye, EyeOff, Loader2 } from "lucide-react"
import Image from "next/image"
import NProgress from "nprogress"

export default function LoginPage() {
  const router = useRouter()

  const [isLoading, setIsLoading] = React.useState(false)
  const [isSuccess, setIsSuccess] = React.useState(false)
  const [showPassword, setShowPassword] = React.useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    setIsLoading(true)
    NProgress.start()

    const formData = new FormData(event.currentTarget)

    try {
      const result = await login(formData)

      if (result?.error) {
        NProgress.done()
        toast.error(result.error)
        setIsLoading(false)
        return
      }

      if (result?.success) {
        setIsSuccess(true)
        // Session token is securely stored in HttpOnly cookie by Server Action
        const redirectTo = result.redirectTo || "/"
        router.push(redirectTo)
        return
      }

      NProgress.done()
      setIsLoading(false)
    } catch (error) {
      NProgress.done()
      setIsLoading(false)

      toast.error("Something went wrong.")
      console.error(error)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div
        className={`w-full max-w-md space-y-6 transition-all duration-300 ${isSuccess ? "scale-[0.99] opacity-90" : "scale-100 opacity-100"
          }`}
      >
        <Card className="border-border">
          <div className="flex flex-col items-center space-y-3 text-center pt-6">
            <Image
              src="/logo.png"
              alt="Bestlink Clinic Center"
              width={300}
              height={150}
              priority
              className="h-20 w-auto object-contain"
            />
          </div>

          <form onSubmit={handleSubmit}>
            <CardContent className="grid gap-4 pt-4">
              <div className="grid gap-2">
                <Label
                  htmlFor="email"
                  className="text-xs font-semibold text-foreground"
                >
                  Email Address
                </Label>

                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="Enter your email address"
                  required
                  disabled={isLoading || isSuccess}
                  className="h-10"
                />
              </div>

              <div className="grid gap-2">
                <Label
                  htmlFor="password"
                  className="text-xs font-semibold text-foreground"
                >
                  Password
                </Label>

                <div className="relative">
                  <Input
                    id="password"
                    name="password"
                    placeholder="Enter your password"
                    type={showPassword ? "text" : "password"}
                    required
                    disabled={isLoading || isSuccess}
                    className="h-10 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    disabled={isLoading || isSuccess}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      <EyeOff className="size-3.5" />
                    ) : (
                      <Eye className="size-3.5" />
                    )}
                  </button>
                </div>
              </div>
            </CardContent>

            <CardFooter className="flex flex-col gap-4 pb-6 pt-3">
              <Button
                type="submit"
                disabled={isLoading || isSuccess}
                className="h-10 w-full cursor-pointer text-sm font-medium"
              >
                {isSuccess ? (
                  <>
                    <CheckCircle2 className="mr-2 size-4" />
                    Success
                  </>
                ) : isLoading ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  "Sign In"
                )}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  )
}