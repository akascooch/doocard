export class CreatePersonalTipDto {
  amount: number;
  staffId: number;
  staffType: 'BARBER' | 'SERVICE';
  description?: string;
  createdById?: number;
}
