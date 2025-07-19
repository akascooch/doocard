export class CreateTipTransactionDto {
  amount: number;
  staffId: number;
  appointmentId?: number;
  type: 'deposit' | 'withdraw';
  createdById?: number;
} 