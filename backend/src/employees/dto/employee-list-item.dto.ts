/**
 * Canonical shape for employee list endpoints (GET /employees, search, by-service).
 * Display fields (name, phone, email) are flattened from the linked User row.
 */
export interface EmployeeListServiceDto {
  id: number;
  name: string;
  description?: string | null;
  price: number;
  durationMinutes?: number;
}

export interface EmployeeListUserDto {
  id: number;
  name: string;
  phone: string;
  email: string | null;
  role?: string;
}

export interface EmployeeListEmployeeServiceDto {
  id: number;
  serviceId: number;
  service: EmployeeListServiceDto | null;
}

export interface EmployeeListItemDto {
  id: number;
  userId: number;
  name: string;
  phone: string;
  email: string | null;
  specialty: string | null;
  baseSalary: number;
  commissionRate: number;
  isDefault: boolean;
  isActive: boolean;
  status: 'active' | 'inactive';
  services: EmployeeListServiceDto[];
  user: EmployeeListUserDto;
  employeeServices: EmployeeListEmployeeServiceDto[];
}
