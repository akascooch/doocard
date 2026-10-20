"use client"

import { PersonalLedgerScreen } from "@/components/personal/PersonalLedgerScreen"

export default function AdminPersonalExpensesPage() {
  return <PersonalLedgerScreen apiBase="/admin/personal" role="ADMIN" />
}
