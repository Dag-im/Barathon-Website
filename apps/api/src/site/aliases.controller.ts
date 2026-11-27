import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { Public } from '../common/decorators/access.decorators';
import { parse } from '../common/content/crud.controller';
import { PrismaService } from '../prisma/prisma.service';
import { PagesService } from '../pages/pages.service';
import { NavigationService } from '../navigation/navigation.service';
import { FaqService } from '../editorial/editorial';
import { SiteService } from './site.controller';
import { ProductsReadService } from '../catalogue/products.read';

/**
 * Aliases for the endpoint names used by the frontend plan (section 11.2). They return the same
 * payloads as the backend-plan endpoints they wrap.
 */
@ApiTags('public-aliases')
@Controller('public')
export class PublicAliasesController {
  constructor(
    private readonly site: SiteService,
    private readonly pages: PagesService,
    private readonly nav: NavigationService,
    private readonly faqs: FaqService,
    private readonly products: ProductsReadService,
    private readonly prisma: PrismaService,
  ) {}

  @Public()
  @Get('settings')
  settings() {
    return this.site.site();
  }

  @Public()
  @Get('navigation')
  async navigation() {
    const all = await this.nav.publicAll();
    return { header: all.HEADER, footer: { quick: all.FOOTER_QUICK, products: all.FOOTER_PRODUCTS, legal: all.FOOTER_LEGAL } };
  }

  @Public()
  @Get('home')
  home() {
    return this.pages.publicPage('home');
  }

  @Public()
  @Get('about')
  about() {
    return this.pages.publicPage('about');
  }

  @Public()
  @Get('contact')
  async contact() {
    const site = await this.site.site();
    const form = await this.prisma.client.siteSettings.findUnique({ where: { id: 'singleton' } });
    return { channels: site.channels, offices: site.offices, social: site.social, form: form?.contactForm ?? null };
  }

  @Public()
  @Get('faq')
  faq(@Query('group') group?: string) {
    return this.faqs.publicList(group);
  }

  @Public()
  @Get('robots')
  async robots() {
    return { rules: await this.site.robotsText() };
  }

  @Public()
  @Get('search/suggest')
  async suggest(@Query() query: Record<string, string>) {
    const q = parse(z.object({ q: z.string().trim().min(2).max(80) }).strict(), query);
    return { data: await this.products.search(q.q, 8) };
  }
}
