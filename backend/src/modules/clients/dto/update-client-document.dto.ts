import { PartialType } from '@nestjs/swagger';
import { CreateClientDocumentDto } from './create-client-document.dto';

export class UpdateClientDocumentDto extends PartialType(
  CreateClientDocumentDto,
) {}
