"use client"

import { PersonalLedgerScreen } from "@/components/personal/PersonalLedgerScreen"

export default function EmployeePersonalLedgerPage() {
  return <PersonalLedgerScreen apiBase="/personal-ledger" role="EMPLOYEE" />
}
