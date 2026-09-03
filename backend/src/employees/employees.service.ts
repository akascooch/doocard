import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { AssignServicesToEmployeeDto } from './dto/employee-service.dto';
import { mapEmployeesToListItems, mapEmployeeToListItem } from './mappers/employee-list.mapper';
import * as bcrypt from 'bcrypt';

@Injectable()
export class EmployeesService {
  constructor(private prisma: PrismaService) {}

  async create(createEmployeeDto: CreateEmployeeDto) {
    try {
      const { name, phone, email, password, specialty, baseSalary, commissionRate } = createEmployeeDto;

      // Check if user with this phone already exists
      const existingUser = await this.prisma.user.findUnique({
        where: { phone }
      });

      if (existingUser) {
        throw new ConflictException('User with this phone number already exists');
      }

      const existingName = await this.prisma.employee.findFirst({
        where: {
          user: {
            role: 'EMPLOYEE',
            name: {
              equals: name.trim(),
              mode: 'insensitive',
            },
          },
        },
        include: { user: true },
      });
      if (existingName) {
        throw new ConflictException('Employee with this name already exists');
      }

      // Hash password if provided
      const hashedPassword = password ? await bcrypt.hash(password, 10) : await bcrypt.hash('123456', 10);

      // Create user first
      const user = await this.prisma.user.create({
        data: {
          name,
          phone,
          email: email || null,
          password: hashedPassword,
          role: 'EMPLOYEE'
        }
      });

      // Create employee record
      const employee = await this.prisma.employee.create({
        data: {
          userId: user.id,
          specialty: specialty || null,
          baseSalary: baseSalary || 0,
          commissionRate: commissionRate || 0
        },
        include: {
          user: true
        }
      });

      return employee;
    } catch (error) {
      if (error instanceof ConflictException) {
        throw error;
      }
      throw new Error(`Failed to create employee: ${error.message}`);
    }
  }

  async findAll() {
    // Get all employees with user and services
    const employees = await this.prisma.employee.findMany({
      include: {
        user: true,
        employeeServices: {
          include: {
            service: true
          }
        }
      },
      orderBy: {
        id: 'asc'
      }
    });

    return mapEmployeesToListItems(employees);
  }

  async findAllOld() {
    // Old method - kept for backwards compatibility
    const employeeUsers = await this.prisma.user.findMany({
      where: { role: 'EMPLOYEE' },
      include: {
        employee: {
          include: {
            appointments: {
              include: {
                service: true
              }
            },
            employeeServices: {
              include: {
                service: true
              }
            }
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Transform the data to match the expected format
    return employeeUsers.map(user => {
      const employee = user.employee;
      
      if (employee) {
        // User has employee record
        const totalAppointments = employee.appointments.length;
        const monthlyEarnings = employee.appointments
          .filter(apt => {
            const aptDate = new Date(apt.scheduledAt);
            const now = new Date();
            return aptDate.getMonth() === now.getMonth() && aptDate.getFullYear() === now.getFullYear();
          })
          .reduce((sum, apt) => sum + (apt.service?.price || 0), 0);

        return {
          id: employee.id,
          userId: employee.userId,
          specialty: employee.specialty,
          baseSalary: employee.baseSalary,
          commissionRate: employee.commissionRate,
          createdAt: employee.createdAt,
          updatedAt: employee.updatedAt,
          totalAppointments,
          monthlyEarnings,
          averageRating: 0,
          status: 'active' as const,
          services: employee.employeeServices.map(es => es.service),
          user: {
            id: user.id,
            name: user.name,
            phone: user.phone,
            email: user.email
          }
        };
      } else {
        // User has EMPLOYEE role but no employee record - create a default one
        return {
          id: user.id, // Use user ID as temporary ID
          userId: user.id,
          specialty: null,
          baseSalary: 0,
          commissionRate: 0,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
          totalAppointments: 0,
          monthlyEarnings: 0,
          averageRating: 0,
          status: 'active' as const,
          services: [],
          user: {
            id: user.id,
            name: user.name,
            phone: user.phone,
            email: user.email
          }
        };
      }
    });
  }

  async findAllActivePublic() {
    const employees = await this.prisma.employee.findMany({
      where: { isActive: true },
      include: { user: true },
      orderBy: [
        { isDefault: 'desc' },
        { id: 'asc' },
      ],
    });
    return employees.map(e => ({
      id: e.id,
      name: e.user?.name,
      isDefault: e.isDefault,
    }));
  }

  /** Active service staff eligible for tip recipient selection (excludes hairstylists). */
  async findActiveServiceStaff() {
    const employees = await this.prisma.employee.findMany({
      where: {
        isActive: true,
        user: { role: 'SERVICE' },
      },
      include: { user: true },
      orderBy: { id: 'asc' },
    });
    return employees.map((e) => ({
      id: e.id,
      name: e.user?.name ?? `پرسنل #${e.id}`,
      role: e.user?.role ?? 'SERVICE',
    }));
  }

  async findOne(id: number) {
    const employee = await this.prisma.employee.findUnique({
      where: { id },
      include: {
        user: true,
        appointments: {
          include: {
            customer: {
              include: { user: true }
            },
            service: true
          },
          orderBy: {
            scheduledAt: 'desc'
          }
        },
        salaries: {
          orderBy: {
            createdAt: 'desc'
          }
        },
        tips: {
          include: {
            appointment: {
              include: {
                customer: {
                  include: { user: true }
                },
                service: true
              }
            }
          },
          orderBy: {
            createdAt: 'desc'
          }
        }
      }
    });

    if (!employee) {
      throw new NotFoundException('Employee not found');
    }

    return employee;
  }

  async update(id: number, updateEmployeeDto: UpdateEmployeeDto) {
    const employee = await this.prisma.employee.findUnique({
      where: { id },
      include: { user: true }
    });

    if (!employee) {
      throw new NotFoundException('Employee not found');
    }

    const { name, phone, email, specialty, baseSalary, commissionRate } = updateEmployeeDto;

    return this.prisma.$transaction(async (tx) => {
      if (name && name.trim().toLowerCase() !== employee.user.name.trim().toLowerCase()) {
        const duplicateName = await tx.employee.findFirst({
          where: {
            id: { not: id },
            user: {
              role: 'EMPLOYEE',
              name: {
                equals: name.trim(),
                mode: 'insensitive',
              },
            },
          },
        });
        if (duplicateName) {
          throw new ConflictException('Employee with this name already exists');
        }
      }

      // Update user data
      if (name || phone || email !== undefined) {
        await tx.user.update({
          where: { id: employee.userId },
          data: {
            ...(name && { name }),
            ...(phone && { phone }),
            ...(email !== undefined && { email: email || null })
          }
        });
      }

      // Update employee data
      const updatedEmployee = await tx.employee.update({
        where: { id },
        data: {
          ...(specialty !== undefined && { specialty: specialty || null }),
          ...(baseSalary !== undefined && { baseSalary }),
          ...(commissionRate !== undefined && { commissionRate })
        },
        include: {
          user: true
        }
      });

      return updatedEmployee;
    });
  }

  async remove(id: number) {
    const employee = await this.prisma.employee.findUnique({
      where: { id },
      include: { user: true }
    });

    if (!employee) {
      throw new NotFoundException('Employee not found');
    }

    return this.prisma.$transaction(async (tx) => {
      // Delete employee record
      await tx.employee.delete({
        where: { id }
      });

      // Delete user record
      await tx.user.delete({
        where: { id: employee.userId }
      });

      return { message: 'Employee deleted successfully' };
    });
  }

  async searchEmployees(query: string) {
    const employees = await this.prisma.employee.findMany({
      where: {
        OR: [
          {
            user: {
              name: {
                contains: query,
                mode: 'insensitive'
              }
            }
          },
          {
            user: {
              phone: {
                contains: query
              }
            }
          },
          {
            user: {
              email: {
                contains: query,
                mode: 'insensitive'
              }
            }
          },
          {
            specialty: {
              contains: query,
              mode: 'insensitive'
            }
          }
        ]
      },
      include: {
        user: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return mapEmployeesToListItems(employees);
  }

  async getEmployeeStats(employeeId: number) {
    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      include: {
        appointments: {
          include: {
            service: true,
            transactions: true
          }
        },
        tips: true,
        salaries: true
      }
    });

    if (!employee) {
      throw new NotFoundException('Employee not found');
    }

    const totalAppointments = employee.appointments.length;
    const completedAppointments = employee.appointments.filter(apt => apt.status === 'COMPLETED').length;
    const totalRevenue = employee.appointments
      .filter(apt => apt.status === 'COMPLETED')
      .reduce((sum, apt) => sum + (apt.service?.price || 0), 0);
    const totalTips = employee.tips.reduce((sum, tip) => sum + tip.amount, 0);
    const totalSalaries = employee.salaries.reduce((sum, salary) => sum + salary.amount, 0);

    return {
      totalAppointments,
      completedAppointments,
      pendingAppointments: totalAppointments - completedAppointments,
      totalRevenue,
      totalTips,
      totalSalaries,
      totalEarnings: totalTips + totalSalaries,
      averageRevenuePerAppointment: completedAppointments > 0 ? totalRevenue / completedAppointments : 0
    };
  }

  // Employee-Service relationship methods
  async getEmployeeServices(employeeId: number) {
    // Try to find employee by ID
    let employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      include: { user: true }
    });
    
    // If not found, check if this ID is a user ID with EMPLOYEE role
    if (!employee) {
      const user = await this.prisma.user.findUnique({
        where: { id: employeeId, role: 'EMPLOYEE' },
        include: { 
          employee: {
            include: {
              user: true
            }
          }
        }
      });
      
      if (user?.employee) {
        employee = user.employee;
      } else if (user) {
        // User exists but has no employee record - return empty services
        return [];
      } else {
        throw new NotFoundException(`Employee with ID ${employeeId} not found`);
      }
    }
    
    const employeeServices = await this.prisma.employeeService.findMany({
      where: { employeeId: employee.id },
      include: {
        service: true
      },
      orderBy: {
        service: {
          name: 'asc'
        }
      }
    });

    return employeeServices.map(es => ({
      id: es.id,
      employeeId: es.employeeId,
      serviceId: es.serviceId,
      service: {
        id: es.service.id,
        name: es.service.name,
        description: es.service.description,
        durationMinutes: es.service.durationMinutes,
        price: es.service.price
      },
      createdAt: es.createdAt,
      updatedAt: es.updatedAt
    }));
  }

  async assignServicesToEmployee(employeeId: number, assignServicesDto: AssignServicesToEmployeeDto) {
    console.log(`🔵 Assigning services to employee ${employeeId}:`, assignServicesDto.serviceIds);
    
    // Try to find employee by ID
    let employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      include: { user: true }
    });
    
    // If not found, check if this ID is a user ID with EMPLOYEE role
    if (!employee) {
      console.log(`⚠️ Employee ${employeeId} not found, checking if it's a user ID...`);
      const user = await this.prisma.user.findUnique({
        where: { id: employeeId, role: 'EMPLOYEE' },
        include: { 
          employee: {
            include: {
              user: true
            }
          }
        }
      });
      
      if (user?.employee) {
        console.log(`✅ Found existing employee record for user`);
        employee = user.employee;
      } else if (user) {
        console.log(`✅ Found user with EMPLOYEE role, creating employee record...`);
        // Create employee record for this user
        employee = await this.prisma.employee.create({
          data: {
            userId: user.id,
            specialty: null,
            baseSalary: 0,
            commissionRate: 0
          },
          include: { user: true }
        });
        console.log(`✅ Employee record created with ID:`, employee.id);
      } else {
        throw new NotFoundException(`Employee with ID ${employeeId} not found`);
      }
    }
    
    console.log(`✅ Employee found:`, employee.id);

    // Check if all services exist (only if serviceIds is not empty)
    if (assignServicesDto.serviceIds.length > 0) {
      const services = await this.prisma.service.findMany({
        where: {
          id: {
            in: assignServicesDto.serviceIds
          }
        }
      });

      if (services.length !== assignServicesDto.serviceIds.length) {
        console.error(`❌ Services not found. Requested: ${assignServicesDto.serviceIds.length}, Found: ${services.length}`);
        throw new NotFoundException('One or more services not found');
      }
      console.log(`✅ All services found:`, services.map(s => s.id));
    }

    // Remove existing assignments (use the actual employee ID from the employee object)
    const deleted = await this.prisma.employeeService.deleteMany({
      where: { employeeId: employee.id }
    });
    console.log(`🗑️ Deleted ${deleted.count} existing service assignments`);

    // Create new assignments (only if serviceIds is not empty)
    if (assignServicesDto.serviceIds.length > 0) {
      const employeeServices = await this.prisma.employeeService.createMany({
        data: assignServicesDto.serviceIds.map(serviceId => ({
          employeeId: employee.id,
          serviceId
        }))
      });
      console.log(`✅ Created ${employeeServices.count} new service assignments`);
      
      return {
        message: 'Services assigned successfully',
        assignedCount: employeeServices.count
      };
    } else {
      console.log(`✅ All services removed from employee ${employee.id}`);
      return {
        message: 'All services removed from employee',
        assignedCount: 0
      };
    }
  }

  async removeServiceFromEmployee(employeeId: number, serviceId: number) {
    const employeeService = await this.prisma.employeeService.findUnique({
      where: {
        employeeId_serviceId: {
          employeeId,
          serviceId
        }
      }
    });

    if (!employeeService) {
      throw new NotFoundException('Service assignment not found');
    }

    await this.prisma.employeeService.delete({
      where: {
        employeeId_serviceId: {
          employeeId,
          serviceId
        }
      }
    });

    return { message: 'Service removed from employee successfully' };
  }

  async getEmployeesByService(serviceId: number) {
    // Get employees who can perform this service
    const employeeServices = await this.prisma.employeeService.findMany({
      where: { serviceId },
      include: {
        employee: {
          include: {
            user: true
          }
        }
      }
    });

    // For each employee, count their total appointments
    const employeesWithCount = await Promise.all(
      employeeServices.map(async (es) => {
        const appointmentCount = await this.prisma.appointment.count({
          where: {
            employeeId: es.employee.id,
            // Only count non-cancelled appointments
            status: {
              notIn: ['CANCELLED']
            }
          }
        });

        const item = mapEmployeeToListItem({
          ...es.employee,
          employeeServices: [],
        });
        if (!item) {
          return null;
        }
        return {
          ...item,
          appointmentCount,
        };
      })
    );

    const sorted = employeesWithCount
      .filter((e): e is NonNullable<typeof e> => e !== null)
      .sort((a, b) => b.appointmentCount - a.appointmentCount);

    console.log(
      '📊 Employees sorted by appointment count:',
      sorted.map((e) => `${e.name}: ${e.appointmentCount} appointments`),
    );

    return sorted;
  }
}