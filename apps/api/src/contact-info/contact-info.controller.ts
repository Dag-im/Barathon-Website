import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Inject, Param, Patch, Post, Put } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { ContactChannelType, SocialPlatform } from '@prisma/client';
import { parse, reorderSchema } from '../common/content/crud.controller';
import { SimpleCrud } from '../common/content/simple-crud';
import { ApiError } from '../common/utils/errors';
import { PrismaService } from '../prisma/prisma.service';
import { RevalidationService } from '../revalidation/revalidation.service';
import { tagsFor } from '../common/constants/revalidation-map';

const MAP_HOSTS = ['www.google.com', 'maps.google.com', 'www.openstreetmap.org', 'www.google.com/maps'];

export const channelInput = z.object({
  type: z.nativeEnum(ContactChannelType),
  label: z.string().max(60).nullable().optional(),
  value: z.string().min(1).max(160),
  displayValue: z.string().max(160).nullable().optional(),
  isPrimary: z.boolean().optional(),
  showOnContactPage: z.boolean().optional(),
  showInFooter: z.boolean().optional(),
  showInHeader: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
  visible: z.boolean().optional(),
}).strict();

export const officeInput = z.object({
  name: z.string().min(1).max(120),
  isPrimary: z.boolean().optional(),
  addressLine1: z.string().min(1).max(200),
  addressLine2: z.string().max(200).nullable().optional(),
  poBox: z.string().max(60).nullable().optional(),
  city: z.string().min(1).max(100),
  region: z.string().max(100).nullable().optional(),
  postalCode: z.string().max(20).nullable().optional(),
  countryCode: z.string().length(2),
  countryName: z.string().min(1).max(80),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  mapEmbedUrl: z.string().url().max(600).nullable().optional(),
  openingHours: z.array(z.object({ days: z.string(), open: z.string(), close: z.string() }).strict()).nullable().optional(),
  subsidiaryId: z.string().uuid().nullable().optional(),
  sortOrder: z.number().int().optional(),
  visible: z.boolean().optional(),
}).strict();

export const socialInput = z.object({
  platform: z.nativeEnum(SocialPlatform),
  url: z.string().url().max(500).nullable().optional(),
  label: z.string().max(60).nullable().optional(),
  showInFooter: z.boolean().optional(),
  showOnContactPage: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
  visible: z.boolean().optional(),
}).strict();

/** Map embeds may only come from allow-listed hosts (backend-plan 3.8, checklist 55). */
export function assertMapHost(url: string | null | undefined): void {
  if (!url) return;
  const host = new URL(url).hostname;
  const path = new URL(url).pathname;
  const ok = MAP_HOSTS.includes(host) && (host !== 'www.google.com' || path.startsWith('/maps'));
  if (!ok) throw ApiError.validation([{ field: 'mapEmbedUrl', message: 'Map host is not allowed' }]);
}

/** A social link cannot be visible without a URL (checklist 53). */
export function assertSocialVisible(row: { visible?: boolean; url?: string | null }): void {
  if (row.visible && !row.url) throw ApiError.validation([{ field: 'visible', message: 'A social link needs a URL before it can be shown' }]);
}

@ApiTags('admin-contact-info')
@Controller('admin')
export class ContactInfoAdminController {
  private readonly channels: SimpleCrud;
  private readonly offices: SimpleCrud;
  private readonly socials: SimpleCrud;

  constructor(
    private readonly prisma: PrismaService,
    private readonly reval: RevalidationService,
  ) {
    this.channels = new SimpleCrud(prisma, 'contactChannel', channelInput, channelInput.partial());
    this.offices = new SimpleCrud(prisma, 'office', officeInput, officeInput.partial());
    this.socials = new SimpleCrud(prisma, 'socialLink', socialInput, socialInput.partial());
  }

  private site() {
    const t = tagsFor('site');
    this.reval.enqueue(t.tags, t.paths);
  }

  @Get('contact-channels')
  async listChannels() {
    return { data: await this.channels.list() };
  }

  @Post('contact-channels')
  async createChannel(@Body() body: unknown) {
    const row = await this.channels.create(body);
    this.site();
    return row;
  }

  @Patch('contact-channels/:id')
  async patchChannel(@Param('id') id: string, @Body() body: unknown) {
    const row = await this.channels.update(id, body);
    this.site();
    return row;
  }

  @Delete('contact-channels/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteChannel(@Param('id') id: string): Promise<void> {
    await this.channels.remove(id);
    this.site();
  }

  @Put('contact-channels/reorder')
  async reorderChannels(@Body() body: unknown) {
    await this.channels.reorder(parse(reorderSchema, body).ids);
    this.site();
    return { ok: true };
  }

  @Get('offices')
  async listOffices() {
    return { data: await this.offices.list() };
  }

  @Post('offices')
  async createOffice(@Body() body: unknown) {
    const parsed = parse(officeInput, body);
    assertMapHost(parsed.mapEmbedUrl);
    const row = await this.offices.create(parsed);
    this.site();
    return row;
  }

  @Patch('offices/:id')
  async patchOffice(@Param('id') id: string, @Body() body: unknown) {
    const parsed = parse(officeInput.partial(), body);
    assertMapHost(parsed.mapEmbedUrl);
    const row = await this.offices.update(id, parsed);
    this.site();
    return row;
  }

  @Delete('offices/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteOffice(@Param('id') id: string): Promise<void> {
    await this.offices.remove(id);
    this.site();
  }

  @Get('social-links')
  async listSocial() {
    return { data: await this.socials.list() };
  }

  @Post('social-links')
  async createSocial(@Body() body: unknown) {
    const parsed = parse(socialInput, body);
    assertSocialVisible(parsed);
    const row = await this.socials.create(parsed);
    this.site();
    return row;
  }

  @Patch('social-links/:id')
  async patchSocial(@Param('id') id: string, @Body() body: unknown) {
    const parsed = parse(socialInput.partial(), body);
    const current = await this.socials.get(id);
    assertSocialVisible({ visible: parsed.visible ?? current.visible, url: parsed.url !== undefined ? parsed.url : current.url });
    const row = await this.socials.update(id, parsed);
    this.site();
    return row;
  }

  @Delete('social-links/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteSocial(@Param('id') id: string): Promise<void> {
    await this.socials.remove(id);
    this.site();
  }
}

