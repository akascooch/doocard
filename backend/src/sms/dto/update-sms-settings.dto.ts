export class UpdateSmsSettingsDto {
  apiKey?: string;
  lineNumber?: string;
  isEnabled?: boolean;
  sendBeforeAppointment?: number;
  sendAfterAppointment?: number;
  defaultMessage?: string;
} 