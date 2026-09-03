import { Controller, Get, Put, Body, UseGuards } from '@nestjs/common';
import { HomepageService } from './homepage.service';
import { UpdateHomepageDetailsDto } from './dto/update-homepage-details.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('homepage')
export class HomepageController {
  constructor(private readonly homepageService: HomepageService) {}

  @Get()
  getHomepageDetails() {
    return this.homepageService.getHomepageDetails();
  }

  @Put()
  @UseGuards(JwtAuthGuard)
  @Roles('ADMIN')
  updateHomepageDetails(@Body() updateHomepageDetailsDto: UpdateHomepageDetailsDto) {
    return this.homepageService.updateHomepageDetails(updateHomepageDetailsDto);
  }
}
