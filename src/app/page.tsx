import { redirect } from 'next/navigation'

export default function Home() {
  // Simple redirect to login - will add full auth after DB setup
  redirect('/auth/login')
}
