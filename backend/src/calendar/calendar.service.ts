import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import jalaali from 'jalaali-js';

@Injectable()
export class CalendarService {
  private readonly logger = new Logger(CalendarService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Get calendar entry by Gregorian date
   */
  async getByGregorian(date: Date) {
    // Normalize to date only (remove time)
    const normalized = new Date(Date.UTC(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
      0, 0, 0, 0
    ));

    const calendar = await this.prisma.calendarDate.findFirst({
      where: { gregorianDate: normalized },
    });

    if (!calendar) {
      this.logger.warn(`Calendar date not found for Gregorian: ${normalized.toISOString()}`);
      return null;
    }

    return calendar;
  }

  /**
   * Get calendar entry by Jalali date string (YYYY-MM-DD)
   */
  async getByJalali(jalaliDate: string) {
    // Validate format
    if (!this.isValidJalaliFormat(jalaliDate)) {
      throw new BadRequestException(
        `Invalid Jalali date format. Expected YYYY-MM-DD, got: ${jalaliDate}`,
      );
    }

    const calendar = await this.prisma.calendarDate.findUnique({
      where: { jalaliDate },
    });

    if (!calendar) {
      this.logger.warn(`Calendar date not found for Jalali: ${jalaliDate}`);
      return null;
    }

    return calendar;
  }

  /**
   * Convert Jalali date string to Gregorian Date
   */
  toGregorian(jalaliDate: string): Date {
    if (!this.isValidJalaliFormat(jalaliDate)) {
      throw new BadRequestException(
        `Invalid Jalali date format. Expected YYYY-MM-DD, got: ${jalaliDate}`,
      );
    }

    const [jy, jm, jd] = jalaliDate.split('-').map(Number);

    if (!jalaali.isValidJalaaliDate(jy, jm, jd)) {
      throw new BadRequestException(
        `Invalid Jalali date: ${jalaliDate}`,
      );
    }

    const { gy, gm, gd } = jalaali.toGregorian(jy, jm, jd);
    return new Date(Date.UTC(gy, gm - 1, gd, 0, 0, 0, 0));
  }

  /**
   * Convert Gregorian Date to Jalali date string (YYYY-MM-DD)
   */
  toJalali(date: Date): string {
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();

    const { jy, jm, jd } = jalaali.toJalaali(year, month, day);
    return `${jy}-${String(jm).padStart(2, '0')}-${String(jd).padStart(2, '0')}`;
  }

  /**
   * Ensure calendar date exists, create if missing (emergency fallback)
   */
  async ensureExists(input: { jalaliDate?: string; gregorianDate?: Date }) {
    let calendar;

    // Try Jalali first
    if (input.jalaliDate) {
      calendar = await this.getByJalali(input.jalaliDate);
      if (calendar) return calendar;

      // Create missing entry
      const gregorianDate = this.toGregorian(input.jalaliDate);
      return this.createCalendarEntry(gregorianDate);
    }

    // Try Gregorian
    if (input.gregorianDate) {
      calendar = await this.getByGregorian(input.gregorianDate);
      if (calendar) return calendar;

      // Create missing entry
      return this.createCalendarEntry(input.gregorianDate);
    }

    throw new BadRequestException('Must provide either jalaliDate or gregorianDate');
  }

  /**
   * Get calendar entry by ID
   */
  async getById(id: number) {
    return this.prisma.calendarDate.findUnique({
      where: { id },
    });
  }

  /**
   * Get calendar entries for a date range (Gregorian)
   */
  async getRange(startDate: Date, endDate: Date) {
    const start = new Date(Date.UTC(
      startDate.getFullYear(),
      startDate.getMonth(),
      startDate.getDate(),
      0, 0, 0, 0
    ));

    const end = new Date(Date.UTC(
      endDate.getFullYear(),
      endDate.getMonth(),
      endDate.getDate(),
      23, 59, 59, 999
    ));

    return this.prisma.calendarDate.findMany({
      where: {
        gregorianDate: {
          gte: start,
          lte: end,
        },
      },
      orderBy: { gregorianDate: 'asc' },
    });
  }

  /**
   * Get calendar entries for a Jalali month
   */
  async getJalaliMonth(year: number, month: number) {
    return this.prisma.calendarDate.findMany({
      where: {
        jalaliYear: year,
        jalaliMonth: month,
      },
      orderBy: { jalaliDay: 'asc' },
    });
  }

  /**
   * Validate Jalali date format (YYYY-MM-DD)
   */
  private isValidJalaliFormat(jalaliDate: string): boolean {
    const regex = /^\d{4}-\d{2}-\d{2}$/;
    return regex.test(jalaliDate);
  }

  /**
   * Create a calendar entry (emergency fallback for missing dates)
   */
  private async createCalendarEntry(gregorianDate: Date) {
    const year = gregorianDate.getFullYear();
    const month = gregorianDate.getMonth() + 1;
    const day = gregorianDate.getDate();

    const { jy, jm, jd } = jalaali.toJalaali(year, month, day);
    const jalaliDate = `${jy}-${String(jm).padStart(2, '0')}-${String(jd).padStart(2, '0')}`;

    const gregorianDayOfWeek = gregorianDate.getDay();
    const isoWeek = this.getISOWeek(gregorianDate);

    const normalized = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));

    this.logger.log(`Creating missing calendar entry: ${jalaliDate} / ${normalized.toISOString().split('T')[0]}`);

    return this.prisma.calendarDate.create({
      data: {
        gregorianDate: normalized,
        jalaliDate,
        gregorianDayOfWeek,
        jalaliDayOfWeek: gregorianDayOfWeek,
        isoWeek,
        gregorianYear: year,
        gregorianMonth: month,
        gregorianDay: day,
        jalaliYear: jy,
        jalaliMonth: jm,
        jalaliDay: jd,
      },
    });
  }

  /**
   * Get ISO week number
   */
  private getISOWeek(date: Date): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  }

  /**
   * Parse date input (accepts Jalali string, Gregorian Date, or ISO string)
   */
  async parseDate(input: string | Date): Promise<Date> {
    if (input instanceof Date) {
      return input;
    }

    // Check if it's Jalali format (YYYY-MM-DD with Persian year range)
    const jalaliRegex = /^(\d{4})-(\d{2})-(\d{2})$/;
    const match = input.match(jalaliRegex);

    if (match) {
      const year = parseInt(match[1]);
      // Jalali years are typically 1300-1500
      if (year >= 1300 && year <= 1500) {
        return this.toGregorian(input);
      }
    }

    // Try parsing as ISO date
    const date = new Date(input);
    if (isNaN(date.getTime())) {
      throw new BadRequestException(`Invalid date format: ${input}`);
    }

    return date;
  }
}

