import { PartialType } from '@nestjs/swagger';
import { CreateClientDealDto } from './create-client-deal.dto';

export class UpdateClientDealDto extends PartialType(CreateClientDealDto) {}
