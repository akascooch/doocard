import { Logger } from '@nestjs/common';
import {
  EmployeeListEmployeeServiceDto,
  EmployeeListItemDto,
  EmployeeListServiceDto,
} from '../dto/employee-list-item.dto';

const logger = new Logger('EmployeeListMapper');

type EmployeeServiceWithService = {
  id: number;
  serviceId: number;
  service: {
    id: number;
    name: string;
    description?: string | null;
    price: number;
    durationMinutes?: number;
  } | null;
};

type EmployeeWithUserAndServices = {
  id: number;
  userId: number;
  specialty: string | null;
  baseSalary: number;
  commissionRate: number;
  isDefault: boolean;
  isActive: boolean;
  user: {
    id: number;
    name: string;
    phone: string;
    email: string | null;
  } | null;
  employeeServices?: EmployeeServiceWithService[];
};

function mapService(service: NonNullable<EmployeeServiceWithService['service']>): EmployeeListServiceDto {
  return {
    id: service.id,
    name: service.name,
    description: service.description ?? null,
    price: service.price,
    durationMinutes: service.durationMinutes,
  };
}

function mapEmployeeServices(
  employeeServices: EmployeeServiceWithService[] | undefined,
): {
  services: EmployeeListServiceDto[];
  employeeServices: EmployeeListEmployeeServiceDto[];
} {
  const rows = employeeServices ?? [];
  const services: EmployeeListServiceDto[] = [];
  const mapped: EmployeeListEmployeeServiceDto[] = [];

  for (const es of rows) {
    const serviceDto = es.service ? mapService(es.service) : null;
    if (serviceDto) {
      services.push(serviceDto);
    }
    mapped.push({
      id: es.id,
      serviceId: es.serviceId,
      service: serviceDto,
    });
  }

  return { services, employeeServices: mapped };
}

/**
 * Maps a Prisma employee row to the canonical list DTO.
 * Returns null when the linked user is missing (data integrity issue).
 */
export function mapEmployeeToListItem(
  emp: EmployeeWithUserAndServices,
): EmployeeListItemDto | null {
  if (!emp.user) {
    logger.warn(`Employee id=${emp.id} has no linked user (userId=${emp.userId}); omitting from list`);
    return null;
  }

  const { services, employeeServices } = mapEmployeeServices(emp.employeeServices);

  return {
    id: emp.id,
    userId: emp.userId,
    name: emp.user.name,
    phone: emp.user.phone,
    email: emp.user.email,
    specialty: emp.specialty,
    baseSalary: emp.baseSalary,
    commissionRate: emp.commissionRate,
    isDefault: emp.isDefault,
    isActive: emp.isActive,
    status: emp.isActive ? 'active' : 'inactive',
    services,
    user: {
      id: emp.user.id,
      name: emp.user.name,
      phone: emp.user.phone,
      email: emp.user.email,
    },
    employeeServices,
  };
}

export function mapEmployeesToListItems(
  employees: EmployeeWithUserAndServices[],
): EmployeeListItemDto[] {
  return employees
    .map(mapEmployeeToListItem)
    .filter((item): item is EmployeeListItemDto => item !== null);
}
