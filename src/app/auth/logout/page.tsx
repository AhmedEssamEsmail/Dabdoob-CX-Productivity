import { redirect } from 'next/navigation'

export default function LogoutPage() {
  redirect('/auth/login')
}
