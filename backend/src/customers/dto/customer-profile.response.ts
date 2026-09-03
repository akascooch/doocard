export interface CustomerProfileResponseDto {
  id: number
  name?: string | null
  phone?: string | null
  email?: string | null
  birthdate?: Date | null
  notes?: string | null
  preferredEmployee: null | {
    id: number
    name?: string | null
    specialty?: string | null
    avatarUrl?: string | null
  }
}


