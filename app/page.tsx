import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'

export default async function Page() {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const { data: patients } = await supabase.from('patients').select()

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8">
      <h1 className="text-4xl font-bold mb-4">Zentraq - AI Driven RFID Clinic</h1>
      <p className="text-lg text-zinc-600 mb-8">
        Tap your RFID ID for instant medical checkup and appointment scheduling
      </p>
      <div className="w-full max-w-md">
        <h2 className="text-2xl font-semibold mb-4">Recent Patients</h2>
        <ul className="space-y-2">
          {patients?.map((patient) => (
            <li key={patient.id} className="p-4 border rounded-lg">
              {patient.name}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
