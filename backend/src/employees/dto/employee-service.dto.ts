import { IsArray, IsInt } from 'class-validator';

export class AssignServicesToEmployeeDto {
  @IsArray()
  @IsInt({ each: true })
  serviceIds: number[];
}

export class EmployeeServiceResponseDto {
  id: number;
  employeeId: number;
  serviceId: number;
  service: {
    id: number;
    name: string;
    description?: string;
    durationMinutes: number;
    price: number;
  };
  createdAt: Date;
  updatedAt: Date;
}
