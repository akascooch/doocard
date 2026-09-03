export type OfflineOperationType =
  | 'CUSTOMER_QUICK'
  | 'APPOINTMENT_CREATE'
  | 'APPOINTMENT_SETTLE';

export type OfflineOperationStatus =
  | 'pending'
  | 'syncing'
  | 'failed'
  | 'done';

export interface CustomerQuickPayload {
  name: string;
  phone: string;
}

export interface CustomerRefOutbox {
  kind: 'outbox';
  outboxId: string;
}

export interface CustomerRefServer {
  kind: 'server';
  customerId: number;
}

export type CustomerRef = CustomerRefOutbox | CustomerRefServer;

export interface AppointmentServicePayload {
  serviceId: number;
  priceAtBooking: number;
  durationMin: number;
}

export interface AppointmentCreatePayload {
  clientOpId: string;
  customerRef: CustomerRef;
  employeeId: number;
  services: AppointmentServicePayload[];
  jalaliDate: string;
  time: string;
  notes?: string;
}

export interface AppointmentRefOutbox {
  kind: 'outbox';
  outboxId: string;
}

export interface AppointmentRefServer {
  kind: 'server';
  appointmentId: number;
}

export type AppointmentRef = AppointmentRefOutbox | AppointmentRefServer;

export interface AppointmentSettlePayload {
  externalRef: string;
  appointmentRef: AppointmentRef;
  amount: number;
  paymentMethod: 'CASH';
  accountId?: number;
  notes?: string;
}

export type OfflineOperationPayload =
  | CustomerQuickPayload
  | AppointmentCreatePayload
  | AppointmentSettlePayload;

export interface CustomerQuickResult {
  customerId: number;
}

export interface AppointmentCreateResult {
  appointmentId: number;
}

export interface AppointmentSettleResult {
  appointmentId: number;
}

export type OfflineOperationResult =
  | CustomerQuickResult
  | AppointmentCreateResult
  | AppointmentSettleResult;

export interface OfflineOutboxItem {
  id: string;
  type: OfflineOperationType;
  payload: OfflineOperationPayload;
  status: OfflineOperationStatus;
  attempts: number;
  createdAt: string;
  updatedAt: string;
  lastError?: string;
  dependsOn?: string[];
  result?: OfflineOperationResult;
  idempotencyKey?: string;
}

export interface OutboxSummary {
  pending: number;
  failed: number;
  syncing: number;
  done: number;
  total: number;
}
