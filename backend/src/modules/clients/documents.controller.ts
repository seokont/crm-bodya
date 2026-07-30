import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { createReadStream } from 'node:fs';
import { extname } from 'node:path';
import { AuthUser } from '../auth/auth-user.interface';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CreateClientDocumentDto } from './dto/create-client-document.dto';
import { UpdateClientDocumentDto } from './dto/update-client-document.dto';
import {
  DocumentsService,
  UploadedDocumentFile,
} from './documents.service';

const MAX_DOCUMENT_SIZE = 20 * 1024 * 1024;
const allowedExtensions = new Set([
  '.pdf',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.txt',
  '.rtf',
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.zip',
]);

@ApiTags('client documents')
@ApiBearerAuth()
@Controller('clients/:clientId/documents')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Get()
  @ApiOperation({ summary: 'Отримати документи клієнта' })
  findAll(@Param('clientId', ParseIntPipe) clientId: number) {
    return this.documentsService.findAll(clientId);
  }

  @Post()
  @ApiOperation({ summary: 'Завантажити документ клієнта' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: { type: 'string', format: 'binary' },
        title: { type: 'string', maxLength: 160 },
        category: {
          type: 'string',
          enum: [
            'CONTRACT',
            'INVOICE',
            'ACT',
            'APPLICATION',
            'POWER_OF_ATTORNEY',
            'OTHER',
          ],
        },
        description: { type: 'string', maxLength: 1000 },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      defParamCharset: 'utf8',
      limits: {
        fileSize: MAX_DOCUMENT_SIZE,
        files: 1,
        fields: 3,
      },
      fileFilter: (_request, file, callback) => {
        const extension = extname(file.originalname).toLowerCase();
        if (!allowedExtensions.has(extension)) {
          callback(
            new BadRequestException(
              'Дозволено PDF, Word, Excel, TXT, RTF, зображення та ZIP',
            ),
            false,
          );
          return;
        }
        callback(null, true);
      },
    }),
  )
  create(
    @Param('clientId', ParseIntPipe) clientId: number,
    @Body() dto: CreateClientDocumentDto,
    @UploadedFile() file: UploadedDocumentFile | undefined,
    @CurrentUser() user: AuthUser,
  ) {
    return this.documentsService.create(clientId, dto, file, user);
  }

  @Get(':documentId/download')
  @ApiOperation({ summary: 'Завантажити файл документа' })
  async download(
    @Param('clientId', ParseIntPipe) clientId: number,
    @Param('documentId', ParseIntPipe) documentId: number,
  ) {
    const document = await this.documentsService.getForDownload(
      clientId,
      documentId,
    );
    return new StreamableFile(createReadStream(document.path), {
      type: document.mimeType,
      disposition: this.contentDisposition(document.originalName),
    });
  }

  @Patch(':documentId')
  @ApiOperation({ summary: 'Оновити дані документа' })
  update(
    @Param('clientId', ParseIntPipe) clientId: number,
    @Param('documentId', ParseIntPipe) documentId: number,
    @Body() dto: UpdateClientDocumentDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.documentsService.update(clientId, documentId, dto, user);
  }

  @Delete(':documentId')
  @ApiOperation({ summary: 'Видалити документ' })
  remove(
    @Param('clientId', ParseIntPipe) clientId: number,
    @Param('documentId', ParseIntPipe) documentId: number,
    @CurrentUser() user: AuthUser,
  ) {
    return this.documentsService.remove(clientId, documentId, user);
  }

  private contentDisposition(filename: string) {
    const fallback = filename
      .replace(/[^\x20-\x7e]/g, '_')
      .replace(/["\\]/g, '_');
    const encoded = encodeURIComponent(filename).replace(
      /['()*]/g,
      (character) =>
        `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
    );
    return `attachment; filename="${fallback}"; filename*=UTF-8''${encoded}`;
  }
}
