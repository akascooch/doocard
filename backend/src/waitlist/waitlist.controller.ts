import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateWaitlistDto } from './dto/create-waitlist.dto';
import { WaitlistService } from './waitlist.service';

@Controller('public/waitlist')
@UseGuards(JwtAuthGuard, ThrottlerGuard)
export class PublicWaitlistController {
  constructor(private readonly waitlistService: WaitlistService) {}

  @Post()
  @Throttle({ short: { limit: 8, ttl: 60_000 } })
  subscribe(@Body() dto: CreateWaitlistDto, @Req() req: { user?: unknown }) {
    return this.waitlistService.subscribe(dto, req.user);
  }
}

@Controller('waitlist')
@UseGuards(JwtAuthGuard)
export class WaitlistController {
  constructor(private readonly waitlistService: WaitlistService) {}

  @Get('my')
  listMine(@Req() req: { user?: unknown }) {
    return this.waitlistService.listMine(req.user);
  }

  @Delete(':id')
  cancel(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Req() req: { user?: unknown },
  ) {
    return this.waitlistService.cancel(id, req.user);
  }
}
