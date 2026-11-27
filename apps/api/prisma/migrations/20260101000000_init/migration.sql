-- Extensions required by the search and citext columns
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN');

-- CreateEnum
CREATE TYPE "ContentStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "MessageStatus" AS ENUM ('NEW', 'READ', 'REPLIED', 'ARCHIVED', 'SPAM');

-- CreateEnum
CREATE TYPE "MediaKind" AS ENUM ('IMAGE', 'SVG', 'ICON', 'DOCUMENT', 'VIDEO');

-- CreateEnum
CREATE TYPE "VideoSourceType" AS ENUM ('UPLOAD', 'YOUTUBE');

-- CreateEnum
CREATE TYPE "MediaVisibility" AS ENUM ('PUBLIC', 'PRIVATE');

-- CreateEnum
CREATE TYPE "SocialPlatform" AS ENUM ('FACEBOOK', 'X', 'LINKEDIN', 'INSTAGRAM', 'YOUTUBE', 'TELEGRAM', 'TIKTOK', 'WHATSAPP');

-- CreateEnum
CREATE TYPE "ContactChannelType" AS ENUM ('PHONE', 'EMAIL', 'WHATSAPP', 'FAX');

-- CreateEnum
CREATE TYPE "MenuLocation" AS ENUM ('HEADER', 'FOOTER_QUICK', 'FOOTER_PRODUCTS', 'FOOTER_LEGAL');

-- CreateEnum
CREATE TYPE "MenuItemType" AS ENUM ('PAGE', 'ENTITY', 'CUSTOM', 'DYNAMIC_PRODUCTS', 'DYNAMIC_SERVICES', 'DYNAMIC_BRANDS');

-- CreateEnum
CREATE TYPE "LinkTarget" AS ENUM ('SELF', 'BLANK');

-- CreateEnum
CREATE TYPE "BlockType" AS ENUM ('HERO_CAROUSEL', 'BRANDS_MARQUEE', 'IMAGE_TEXT', 'STATS', 'FEATURED_PRODUCTS', 'VIDEOS_GRID', 'SERVICES_GRID', 'TESTIMONIALS', 'LATEST_POSTS', 'CTA_BANNER', 'TIMELINE', 'LEADER_MESSAGE', 'MISSION_VISION', 'CORE_VALUES', 'SUBSIDIARIES', 'TEAM', 'FAQ', 'RICH_TEXT', 'IMAGE_GALLERY', 'CONTACT_STRIP', 'BRAND_GRID');

-- CreateEnum
CREATE TYPE "CoreValueGroup" AS ENUM ('MISSION', 'VALUE');

-- CreateEnum
CREATE TYPE "BrandKind" AS ENUM ('PRINCIPAL', 'PARTNER');

-- CreateEnum
CREATE TYPE "DocumentLanguage" AS ENUM ('EN', 'AM');

-- CreateEnum
CREATE TYPE "RedirectType" AS ENUM ('MOVED_301', 'FOUND_302', 'TEMP_307', 'PERM_308');

-- CreateEnum
CREATE TYPE "RedirectMatch" AS ENUM ('EXACT', 'PREFIX');

-- CreateEnum
CREATE TYPE "EntityType" AS ENUM ('PAGE', 'PRODUCT', 'PRODUCT_CATEGORY', 'BRAND', 'SERVICE', 'POST', 'POST_CATEGORY', 'SUBSIDIARY', 'VIDEO');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'RESTORE', 'PURGE', 'PUBLISH', 'UNPUBLISH', 'SCHEDULE', 'ARCHIVE', 'REORDER', 'LOGIN', 'LOGIN_FAILED', 'LOGOUT', 'TOKEN_REFRESH', 'REFRESH_REUSE_DETECTED', 'PASSWORD_CHANGE', 'PASSWORD_RESET', 'SESSION_REVOKE', 'ACCOUNT_LOCKED', 'ACCOUNT_UNLOCKED', 'SETTINGS_UPDATE', 'IMPORT', 'EXPORT', 'REVALIDATE', 'MESSAGE_STATUS', 'MESSAGE_NOTE', 'MEDIA_UPLOAD', 'MEDIA_DELETE', 'CLI');

-- CreateEnum
CREATE TYPE "TwitterCard" AS ENUM ('SUMMARY', 'SUMMARY_LARGE_IMAGE');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" CITEXT NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'ADMIN',
    "passwordHash" TEXT NOT NULL,
    "pepperVersion" INTEGER NOT NULL DEFAULT 1,
    "passwordChangedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
    "tokenVersion" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "failedLoginCount" INTEGER NOT NULL DEFAULT 0,
    "lockCount" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "lastLoginIp" VARCHAR(64),
    "totpSecretEnc" TEXT,
    "totpEnabledAt" TIMESTAMP(3),
    "totpLastStep" INTEGER,
    "avatarMediaId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_sessions" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "userAgent" VARCHAR(400),
    "deviceLabel" VARCHAR(120),
    "ip" VARCHAR(64),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "idleExpiresAt" TIMESTAMP(3) NOT NULL,
    "absoluteExpiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "revokedReason" VARCHAR(40),

    CONSTRAINT "auth_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL,
    "sessionId" UUID NOT NULL,
    "tokenHash" VARCHAR(64) NOT NULL,
    "parentId" UUID,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "replacedById" UUID,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_history" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "hash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_folders" (
    "id" UUID NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "parentId" UUID,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "media_folders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media" (
    "id" UUID NOT NULL,
    "kind" "MediaKind" NOT NULL,
    "visibility" "MediaVisibility" NOT NULL DEFAULT 'PUBLIC',
    "bucket" VARCHAR(40) NOT NULL,
    "objectKey" TEXT NOT NULL,
    "originalName" VARCHAR(255) NOT NULL,
    "mimeType" VARCHAR(100) NOT NULL,
    "sizeBytes" BIGINT NOT NULL,
    "sha256" VARCHAR(64) NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "blurhash" VARCHAR(100),
    "dominantColor" VARCHAR(7),
    "lqip" TEXT,
    "alt" VARCHAR(300),
    "caption" VARCHAR(500),
    "title" VARCHAR(200),
    "focalX" DOUBLE PRECISION,
    "focalY" DOUBLE PRECISION,
    "folderId" UUID,
    "version" INTEGER NOT NULL DEFAULT 1,
    "processingStatus" VARCHAR(12) NOT NULL DEFAULT 'READY',
    "uploadedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_variants" (
    "id" UUID NOT NULL,
    "mediaId" UUID NOT NULL,
    "label" VARCHAR(20) NOT NULL,
    "format" VARCHAR(8) NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "objectKey" TEXT NOT NULL,

    CONSTRAINT "media_variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_refs" (
    "id" UUID NOT NULL,
    "mediaId" UUID NOT NULL,
    "entityType" VARCHAR(40) NOT NULL,
    "entityId" VARCHAR(64) NOT NULL,
    "field" VARCHAR(60) NOT NULL,

    CONSTRAINT "media_refs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seo_meta" (
    "id" UUID NOT NULL,
    "entityType" "EntityType" NOT NULL,
    "entityId" UUID NOT NULL,
    "metaTitle" VARCHAR(200),
    "metaDescription" VARCHAR(400),
    "ogTitle" VARCHAR(200),
    "ogDescription" VARCHAR(400),
    "ogImageId" UUID,
    "twitterCard" "TwitterCard" NOT NULL DEFAULT 'SUMMARY_LARGE_IMAGE',
    "canonicalUrl" VARCHAR(500),
    "noindex" BOOLEAN NOT NULL DEFAULT false,
    "nofollow" BOOLEAN NOT NULL DEFAULT false,
    "keywords" VARCHAR(300),
    "jsonLd" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "seo_meta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "site_settings" (
    "id" VARCHAR(20) NOT NULL DEFAULT 'singleton',
    "siteName" VARCHAR(120) NOT NULL,
    "legalName" VARCHAR(200),
    "tagline" VARCHAR(200),
    "logoLightMediaId" UUID,
    "logoDarkMediaId" UUID,
    "faviconMediaId" UUID,
    "appleTouchIconMediaId" UUID,
    "defaultOgImageMediaId" UUID,
    "brandColors" JSONB NOT NULL,
    "headerCta" JSONB NOT NULL,
    "search" JSONB NOT NULL,
    "footerBlurb" TEXT,
    "copyrightText" VARCHAR(300) NOT NULL,
    "footerCredit" JSONB NOT NULL,
    "seoDefaults" JSONB NOT NULL,
    "analytics" JSONB NOT NULL,
    "maintenance" JSONB NOT NULL,
    "announcement" JSONB NOT NULL,
    "contactForm" JSONB NOT NULL,
    "robots" JSONB NOT NULL,
    "sitemap" JSONB NOT NULL,
    "locales" TEXT[] DEFAULT ARRAY['en']::TEXT[],
    "defaultLocale" VARCHAR(5) NOT NULL DEFAULT 'en',
    "version" INTEGER NOT NULL DEFAULT 1,
    "updatedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "site_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ui_strings" (
    "id" UUID NOT NULL,
    "key" VARCHAR(120) NOT NULL,
    "locale" VARCHAR(5) NOT NULL DEFAULT 'en',
    "value" TEXT NOT NULL,
    "group" VARCHAR(40) NOT NULL,
    "description" VARCHAR(200),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ui_strings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contact_channels" (
    "id" UUID NOT NULL,
    "type" "ContactChannelType" NOT NULL,
    "label" VARCHAR(60),
    "value" VARCHAR(160) NOT NULL,
    "displayValue" VARCHAR(160),
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "showOnContactPage" BOOLEAN NOT NULL DEFAULT true,
    "showInFooter" BOOLEAN NOT NULL DEFAULT true,
    "showInHeader" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contact_channels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "offices" (
    "id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "addressLine1" VARCHAR(200) NOT NULL,
    "addressLine2" VARCHAR(200),
    "poBox" VARCHAR(60),
    "city" VARCHAR(100) NOT NULL,
    "region" VARCHAR(100),
    "postalCode" VARCHAR(20),
    "countryCode" VARCHAR(2) NOT NULL,
    "countryName" VARCHAR(80) NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "mapEmbedUrl" VARCHAR(600),
    "openingHours" JSONB,
    "subsidiaryId" UUID,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "offices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "social_links" (
    "id" UUID NOT NULL,
    "platform" "SocialPlatform" NOT NULL,
    "url" VARCHAR(500),
    "label" VARCHAR(60),
    "showInFooter" BOOLEAN NOT NULL DEFAULT true,
    "showOnContactPage" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "visible" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "social_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "menus" (
    "id" UUID NOT NULL,
    "location" "MenuLocation" NOT NULL,
    "title" VARCHAR(80) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "menus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "menu_items" (
    "id" UUID NOT NULL,
    "menuId" UUID NOT NULL,
    "parentId" UUID,
    "type" "MenuItemType" NOT NULL,
    "label" VARCHAR(80) NOT NULL,
    "pageId" UUID,
    "entityType" "EntityType",
    "entityId" UUID,
    "href" VARCHAR(500),
    "target" "LinkTarget" NOT NULL DEFAULT 'SELF',
    "icon" VARCHAR(40),
    "config" JSONB,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "menu_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "redirects" (
    "id" UUID NOT NULL,
    "sourcePath" VARCHAR(500) NOT NULL,
    "matchType" "RedirectMatch" NOT NULL DEFAULT 'EXACT',
    "targetPath" VARCHAR(1000) NOT NULL,
    "type" "RedirectType" NOT NULL DEFAULT 'MOVED_301',
    "auto" BOOLEAN NOT NULL DEFAULT false,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "note" VARCHAR(200),
    "hitCount" INTEGER NOT NULL DEFAULT 0,
    "lastHitAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "redirects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pages" (
    "id" UUID NOT NULL,
    "key" VARCHAR(40),
    "slug" CITEXT NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "template" VARCHAR(30) NOT NULL DEFAULT 'DEFAULT',
    "heroTitle" VARCHAR(200),
    "heroSubtitle" VARCHAR(500),
    "heroImageMediaId" UUID,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "scheduledAt" TIMESTAMP(3),
    "showInSitemap" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdById" UUID,
    "updatedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "pages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "page_blocks" (
    "id" UUID NOT NULL,
    "pageId" UUID NOT NULL,
    "type" "BlockType" NOT NULL,
    "anchorId" VARCHAR(60),
    "navLabel" VARCHAR(60),
    "showInTabNav" BOOLEAN NOT NULL DEFAULT false,
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "page_blocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hero_slides" (
    "id" UUID NOT NULL,
    "eyebrow" VARCHAR(120),
    "heading" VARCHAR(200) NOT NULL,
    "subheading" VARCHAR(500),
    "imageMediaId" UUID NOT NULL,
    "mobileImageMediaId" UUID,
    "overlayOpacity" SMALLINT NOT NULL DEFAULT 40,
    "button1Label" VARCHAR(60),
    "button1Href" VARCHAR(500),
    "button2Label" VARCHAR(60),
    "button2Href" VARCHAR(500),
    "productId" UUID,
    "brandId" UUID,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "status" "ContentStatus" NOT NULL DEFAULT 'PUBLISHED',
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "hero_slides_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stats" (
    "id" UUID NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "prefix" VARCHAR(10),
    "suffix" VARCHAR(10),
    "label" VARCHAR(100) NOT NULL,
    "icon" VARCHAR(40),
    "group" VARCHAR(40) NOT NULL DEFAULT 'GENERAL',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "timeline_entries" (
    "id" UUID NOT NULL,
    "yearLabel" VARCHAR(30) NOT NULL,
    "startYear" INTEGER,
    "title" VARCHAR(160) NOT NULL,
    "description" TEXT,
    "imageMediaId" UUID,
    "icon" VARCHAR(40),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "timeline_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core_values" (
    "id" UUID NOT NULL,
    "group" "CoreValueGroup" NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "description" TEXT,
    "icon" VARCHAR(40),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "status" "ContentStatus" NOT NULL DEFAULT 'PUBLISHED',
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "core_values_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leader_messages" (
    "id" UUID NOT NULL,
    "heading" VARCHAR(120) NOT NULL DEFAULT 'CEO''s Message',
    "name" VARCHAR(120),
    "jobTitle" VARCHAR(120),
    "photoMediaId" UUID,
    "signatureMediaId" UUID,
    "messageHtml" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "status" "ContentStatus" NOT NULL DEFAULT 'PUBLISHED',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "leader_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_members" (
    "id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "jobTitle" VARCHAR(120),
    "bioHtml" TEXT,
    "photoMediaId" UUID,
    "linkedinUrl" VARCHAR(500),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "status" "ContentStatus" NOT NULL DEFAULT 'PUBLISHED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "team_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brands" (
    "id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "slug" CITEXT NOT NULL,
    "kind" "BrandKind" NOT NULL DEFAULT 'PARTNER',
    "shortDescription" VARCHAR(600) NOT NULL,
    "descriptionHtml" TEXT NOT NULL DEFAULT '',
    "logoMediaId" UUID,
    "logoDarkMediaId" UUID,
    "heroImageMediaId" UUID,
    "countryCode" VARCHAR(2),
    "countryName" VARCHAR(80),
    "city" VARCHAR(80),
    "websiteUrl" VARCHAR(500),
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "showInMarquee" BOOLEAN NOT NULL DEFAULT true,
    "legacyId" VARCHAR(24),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "scheduledAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdById" UUID,
    "updatedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "brands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_categories" (
    "id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "slug" CITEXT NOT NULL,
    "description" TEXT,
    "imageMediaId" UUID,
    "parentId" UUID,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "scheduledAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "product_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" UUID NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "slug" CITEXT NOT NULL,
    "shortDescription" VARCHAR(600) NOT NULL,
    "contentHtml" TEXT NOT NULL DEFAULT '',
    "heroImageMediaId" UUID,
    "brandId" UUID,
    "categoryId" UUID,
    "extraCategoryIds" UUID[] DEFAULT ARRAY[]::UUID[],
    "countryCode" VARCHAR(2),
    "countryName" VARCHAR(80),
    "originCity" VARCHAR(80),
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "inquiryEnabled" BOOLEAN NOT NULL DEFAULT true,
    "partNumber" VARCHAR(60),
    "tagline" VARCHAR(200),
    "legacyId" VARCHAR(24),
    "searchVector" tsvector,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "scheduledAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdById" UUID,
    "updatedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_images" (
    "id" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "mediaId" UUID NOT NULL,
    "caption" VARCHAR(300),
    "altOverride" VARCHAR(300),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "product_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_specs" (
    "id" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "groupName" VARCHAR(80),
    "label" VARCHAR(120) NOT NULL,
    "value" VARCHAR(300) NOT NULL,
    "unit" VARCHAR(30),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "product_specs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_documents" (
    "id" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "mediaId" UUID NOT NULL,
    "language" "DocumentLanguage" NOT NULL DEFAULT 'EN',
    "visibility" "MediaVisibility" NOT NULL DEFAULT 'PUBLIC',
    "downloadCount" INTEGER NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_related" (
    "productId" UUID NOT NULL,
    "relatedProductId" UUID NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "product_related_pkey" PRIMARY KEY ("productId","relatedProductId")
);

-- CreateTable
CREATE TABLE "services" (
    "id" UUID NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "slug" CITEXT NOT NULL,
    "shortDescription" VARCHAR(600) NOT NULL,
    "bodyHtml" TEXT,
    "imageMediaId" UUID,
    "iconName" VARCHAR(40),
    "ctaLabel" VARCHAR(60),
    "ctaHref" VARCHAR(300),
    "legacyId" VARCHAR(24),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "scheduledAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdById" UUID,
    "updatedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_features" (
    "id" UUID NOT NULL,
    "serviceId" UUID NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "description" VARCHAR(500),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "service_features_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "videos" (
    "id" UUID NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "description" VARCHAR(600),
    "sourceType" "VideoSourceType" NOT NULL DEFAULT 'YOUTUBE',
    "youtubeId" VARCHAR(11),
    "startSeconds" INTEGER,
    "sourceUrl" VARCHAR(500),
    "mediaId" UUID,
    "posterMediaId" UUID,
    "mimeType" VARCHAR(100),
    "sizeBytes" BIGINT,
    "durationSeconds" INTEGER,
    "brandId" UUID,
    "productId" UUID,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "scheduledAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "videos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subsidiaries" (
    "id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "slug" CITEXT NOT NULL,
    "legalName" VARCHAR(200),
    "kind" VARCHAR(20) NOT NULL DEFAULT 'OTHER',
    "countryCode" VARCHAR(2) NOT NULL,
    "regionNote" VARCHAR(120),
    "tagline" VARCHAR(300),
    "introHtml" TEXT NOT NULL DEFAULT '',
    "bodyHtml" TEXT,
    "lists" JSONB NOT NULL DEFAULT '[]',
    "logoMediaId" UUID,
    "imageMediaId" UUID,
    "websiteUrl" VARCHAR(500),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "scheduledAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "subsidiaries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subsidiary_brands" (
    "subsidiaryId" UUID NOT NULL,
    "brandId" UUID NOT NULL,
    "relation" VARCHAR(40) NOT NULL DEFAULT 'EXCLUSIVE_RIGHTS',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "subsidiary_brands_pkey" PRIMARY KEY ("subsidiaryId","brandId")
);

-- CreateTable
CREATE TABLE "testimonials" (
    "id" UUID NOT NULL,
    "quote" TEXT NOT NULL,
    "personName" VARCHAR(120) NOT NULL,
    "personRole" VARCHAR(120),
    "companyName" VARCHAR(160),
    "photoMediaId" UUID,
    "rating" SMALLINT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "status" "ContentStatus" NOT NULL DEFAULT 'PUBLISHED',
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "testimonials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "faq_groups" (
    "id" UUID NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "slug" CITEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "status" "ContentStatus" NOT NULL DEFAULT 'PUBLISHED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "faq_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "faqs" (
    "id" UUID NOT NULL,
    "groupId" UUID NOT NULL,
    "question" VARCHAR(300) NOT NULL,
    "answerHtml" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "status" "ContentStatus" NOT NULL DEFAULT 'PUBLISHED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "faqs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "post_categories" (
    "id" UUID NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "slug" CITEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "post_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "posts" (
    "id" UUID NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "slug" CITEXT NOT NULL,
    "excerpt" VARCHAR(500) NOT NULL,
    "bodyHtml" TEXT NOT NULL,
    "coverMediaId" UUID,
    "authorName" VARCHAR(120),
    "categoryId" UUID,
    "readingMinutes" SMALLINT NOT NULL DEFAULT 1,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "scheduledAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdById" UUID,
    "updatedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tags" (
    "id" UUID NOT NULL,
    "name" VARCHAR(60) NOT NULL,
    "slug" CITEXT NOT NULL,

    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "post_tags" (
    "postId" UUID NOT NULL,
    "tagId" UUID NOT NULL,

    CONSTRAINT "post_tags_pkey" PRIMARY KEY ("postId","tagId")
);

-- CreateTable
CREATE TABLE "contact_messages" (
    "id" UUID NOT NULL,
    "reference" VARCHAR(14) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "email" CITEXT NOT NULL,
    "phone" VARCHAR(40),
    "message" VARCHAR(5000) NOT NULL,
    "subject" VARCHAR(160),
    "productId" UUID,
    "productTitleSnapshot" VARCHAR(160),
    "sourcePath" VARCHAR(300),
    "consentGiven" BOOLEAN,
    "locale" VARCHAR(5) NOT NULL DEFAULT 'en',
    "status" "MessageStatus" NOT NULL DEFAULT 'NEW',
    "isStarred" BOOLEAN NOT NULL DEFAULT false,
    "spamScore" SMALLINT NOT NULL DEFAULT 0,
    "spamReasons" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "ip" VARCHAR(64),
    "userAgent" VARCHAR(400),
    "readAt" TIMESTAMP(3),
    "repliedAt" TIMESTAMP(3),
    "handledById" UUID,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contact_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contact_message_notes" (
    "id" UUID NOT NULL,
    "messageId" UUID NOT NULL,
    "authorId" UUID,
    "authorName" VARCHAR(120),
    "body" VARCHAR(2000) NOT NULL,
    "kind" VARCHAR(10) NOT NULL DEFAULT 'NOTE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contact_message_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_revisions" (
    "id" UUID NOT NULL,
    "entityType" VARCHAR(40) NOT NULL,
    "entityId" VARCHAR(64) NOT NULL,
    "versionNo" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "changeNote" VARCHAR(200),
    "authorId" UUID,
    "authorName" VARCHAR(120),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "content_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" BIGSERIAL NOT NULL,
    "actorId" UUID,
    "actorEmail" VARCHAR(255),
    "action" "AuditAction" NOT NULL,
    "entityType" VARCHAR(40),
    "entityId" VARCHAR(64),
    "summary" VARCHAR(300) NOT NULL,
    "diff" JSONB,
    "ip" VARCHAR(64),
    "userAgent" VARCHAR(400),
    "requestId" VARCHAR(40),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "revalidation_logs" (
    "id" BIGSERIAL NOT NULL,
    "tags" TEXT[],
    "paths" TEXT[],
    "status" VARCHAR(10) NOT NULL,
    "httpStatus" INTEGER,
    "attempts" INTEGER NOT NULL,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "revalidation_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_isActive_idx" ON "users"("isActive");

-- CreateIndex
CREATE INDEX "auth_sessions_userId_revokedAt_idx" ON "auth_sessions"("userId", "revokedAt");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_tokenHash_key" ON "refresh_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "refresh_tokens_sessionId_idx" ON "refresh_tokens"("sessionId");

-- CreateIndex
CREATE INDEX "refresh_tokens_expiresAt_idx" ON "refresh_tokens"("expiresAt");

-- CreateIndex
CREATE INDEX "password_history_userId_idx" ON "password_history"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "media_folders_parentId_name_key" ON "media_folders"("parentId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "media_objectKey_key" ON "media"("objectKey");

-- CreateIndex
CREATE INDEX "media_kind_idx" ON "media"("kind");

-- CreateIndex
CREATE INDEX "media_folderId_idx" ON "media"("folderId");

-- CreateIndex
CREATE INDEX "media_sha256_idx" ON "media"("sha256");

-- CreateIndex
CREATE INDEX "media_createdAt_idx" ON "media"("createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "media_variants_objectKey_key" ON "media_variants"("objectKey");

-- CreateIndex
CREATE UNIQUE INDEX "media_variants_mediaId_label_format_key" ON "media_variants"("mediaId", "label", "format");

-- CreateIndex
CREATE INDEX "media_refs_entityType_entityId_idx" ON "media_refs"("entityType", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "media_refs_mediaId_entityType_entityId_field_key" ON "media_refs"("mediaId", "entityType", "entityId", "field");

-- CreateIndex
CREATE UNIQUE INDEX "seo_meta_entityType_entityId_key" ON "seo_meta"("entityType", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "ui_strings_key_locale_key" ON "ui_strings"("key", "locale");

-- CreateIndex
CREATE UNIQUE INDEX "menus_location_key" ON "menus"("location");

-- CreateIndex
CREATE INDEX "menu_items_menuId_parentId_sortOrder_idx" ON "menu_items"("menuId", "parentId", "sortOrder");

-- CreateIndex
CREATE INDEX "redirects_enabled_idx" ON "redirects"("enabled");

-- CreateIndex
CREATE UNIQUE INDEX "redirects_sourcePath_matchType_key" ON "redirects"("sourcePath", "matchType");

-- CreateIndex
CREATE UNIQUE INDEX "pages_key_key" ON "pages"("key");

-- CreateIndex
CREATE UNIQUE INDEX "pages_slug_key" ON "pages"("slug");

-- CreateIndex
CREATE INDEX "page_blocks_pageId_sortOrder_idx" ON "page_blocks"("pageId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "brands_slug_key" ON "brands"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "brands_legacyId_key" ON "brands"("legacyId");

-- CreateIndex
CREATE INDEX "brands_status_sortOrder_idx" ON "brands"("status", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "product_categories_slug_key" ON "product_categories"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "products_slug_key" ON "products"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "products_legacyId_key" ON "products"("legacyId");

-- CreateIndex
CREATE INDEX "products_status_sortOrder_idx" ON "products"("status", "sortOrder");

-- CreateIndex
CREATE INDEX "products_brandId_idx" ON "products"("brandId");

-- CreateIndex
CREATE INDEX "products_categoryId_idx" ON "products"("categoryId");

-- CreateIndex
CREATE INDEX "products_isFeatured_idx" ON "products"("isFeatured");

-- CreateIndex
CREATE INDEX "product_images_productId_sortOrder_idx" ON "product_images"("productId", "sortOrder");

-- CreateIndex
CREATE INDEX "product_specs_productId_sortOrder_idx" ON "product_specs"("productId", "sortOrder");

-- CreateIndex
CREATE INDEX "product_documents_productId_sortOrder_idx" ON "product_documents"("productId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "services_slug_key" ON "services"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "services_legacyId_key" ON "services"("legacyId");

-- CreateIndex
CREATE INDEX "services_status_sortOrder_idx" ON "services"("status", "sortOrder");

-- CreateIndex
CREATE INDEX "service_features_serviceId_sortOrder_idx" ON "service_features"("serviceId", "sortOrder");

-- CreateIndex
CREATE INDEX "videos_status_isFeatured_sortOrder_idx" ON "videos"("status", "isFeatured", "sortOrder");

-- CreateIndex
CREATE INDEX "videos_youtubeId_idx" ON "videos"("youtubeId");

-- CreateIndex
CREATE INDEX "videos_brandId_idx" ON "videos"("brandId");

-- CreateIndex
CREATE INDEX "videos_productId_idx" ON "videos"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "subsidiaries_slug_key" ON "subsidiaries"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "faq_groups_slug_key" ON "faq_groups"("slug");

-- CreateIndex
CREATE INDEX "faqs_groupId_sortOrder_idx" ON "faqs"("groupId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "post_categories_slug_key" ON "post_categories"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "posts_slug_key" ON "posts"("slug");

-- CreateIndex
CREATE INDEX "posts_status_publishedAt_idx" ON "posts"("status", "publishedAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "tags_slug_key" ON "tags"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "contact_messages_reference_key" ON "contact_messages"("reference");

-- CreateIndex
CREATE INDEX "contact_messages_status_createdAt_idx" ON "contact_messages"("status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "contact_messages_isStarred_idx" ON "contact_messages"("isStarred");

-- CreateIndex
CREATE INDEX "contact_messages_email_idx" ON "contact_messages"("email");

-- CreateIndex
CREATE INDEX "content_revisions_entityType_entityId_createdAt_idx" ON "content_revisions"("entityType", "entityId", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "content_revisions_entityType_entityId_versionNo_key" ON "content_revisions"("entityType", "entityId", "versionNo");

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "audit_logs_actorId_idx" ON "audit_logs"("actorId");

-- CreateIndex
CREATE INDEX "audit_logs_entityType_entityId_idx" ON "audit_logs"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- AddForeignKey
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "auth_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_history" ADD CONSTRAINT "password_history_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_folders" ADD CONSTRAINT "media_folders_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "media_folders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_variants" ADD CONSTRAINT "media_variants_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "media"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menu_items" ADD CONSTRAINT "menu_items_menuId_fkey" FOREIGN KEY ("menuId") REFERENCES "menus"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menu_items" ADD CONSTRAINT "menu_items_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "menu_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "page_blocks" ADD CONSTRAINT "page_blocks_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_categories" ADD CONSTRAINT "product_categories_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "product_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "product_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_specs" ADD CONSTRAINT "product_specs_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_documents" ADD CONSTRAINT "product_documents_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_related" ADD CONSTRAINT "product_related_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_related" ADD CONSTRAINT "product_related_relatedProductId_fkey" FOREIGN KEY ("relatedProductId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_features" ADD CONSTRAINT "service_features_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "videos" ADD CONSTRAINT "videos_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "videos" ADD CONSTRAINT "videos_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subsidiary_brands" ADD CONSTRAINT "subsidiary_brands_subsidiaryId_fkey" FOREIGN KEY ("subsidiaryId") REFERENCES "subsidiaries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subsidiary_brands" ADD CONSTRAINT "subsidiary_brands_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "faqs" ADD CONSTRAINT "faqs_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "faq_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "posts" ADD CONSTRAINT "posts_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "post_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_tags" ADD CONSTRAINT "post_tags_postId_fkey" FOREIGN KEY ("postId") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_tags" ADD CONSTRAINT "post_tags_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_message_notes" ADD CONSTRAINT "contact_message_notes_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "contact_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Media references (scalar columns with database-level integrity)
ALTER TABLE "users" ADD CONSTRAINT "users_avatarMediaId_fkey" FOREIGN KEY ("avatarMediaId") REFERENCES "media"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "site_settings" ADD CONSTRAINT "site_settings_logoLightMediaId_fkey" FOREIGN KEY ("logoLightMediaId") REFERENCES "media"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "site_settings" ADD CONSTRAINT "site_settings_logoDarkMediaId_fkey" FOREIGN KEY ("logoDarkMediaId") REFERENCES "media"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "site_settings" ADD CONSTRAINT "site_settings_faviconMediaId_fkey" FOREIGN KEY ("faviconMediaId") REFERENCES "media"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "site_settings" ADD CONSTRAINT "site_settings_appleTouchIconMediaId_fkey" FOREIGN KEY ("appleTouchIconMediaId") REFERENCES "media"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "site_settings" ADD CONSTRAINT "site_settings_defaultOgImageMediaId_fkey" FOREIGN KEY ("defaultOgImageMediaId") REFERENCES "media"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "pages" ADD CONSTRAINT "pages_heroImageMediaId_fkey" FOREIGN KEY ("heroImageMediaId") REFERENCES "media"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "hero_slides" ADD CONSTRAINT "hero_slides_imageMediaId_fkey" FOREIGN KEY ("imageMediaId") REFERENCES "media"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "hero_slides" ADD CONSTRAINT "hero_slides_mobileImageMediaId_fkey" FOREIGN KEY ("mobileImageMediaId") REFERENCES "media"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "timeline_entries" ADD CONSTRAINT "timeline_entries_imageMediaId_fkey" FOREIGN KEY ("imageMediaId") REFERENCES "media"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "leader_messages" ADD CONSTRAINT "leader_messages_photoMediaId_fkey" FOREIGN KEY ("photoMediaId") REFERENCES "media"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "leader_messages" ADD CONSTRAINT "leader_messages_signatureMediaId_fkey" FOREIGN KEY ("signatureMediaId") REFERENCES "media"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_photoMediaId_fkey" FOREIGN KEY ("photoMediaId") REFERENCES "media"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "brands" ADD CONSTRAINT "brands_logoMediaId_fkey" FOREIGN KEY ("logoMediaId") REFERENCES "media"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "brands" ADD CONSTRAINT "brands_logoDarkMediaId_fkey" FOREIGN KEY ("logoDarkMediaId") REFERENCES "media"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "brands" ADD CONSTRAINT "brands_heroImageMediaId_fkey" FOREIGN KEY ("heroImageMediaId") REFERENCES "media"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "product_categories" ADD CONSTRAINT "product_categories_imageMediaId_fkey" FOREIGN KEY ("imageMediaId") REFERENCES "media"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "products" ADD CONSTRAINT "products_heroImageMediaId_fkey" FOREIGN KEY ("heroImageMediaId") REFERENCES "media"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "media"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "product_documents" ADD CONSTRAINT "product_documents_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "media"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "services" ADD CONSTRAINT "services_imageMediaId_fkey" FOREIGN KEY ("imageMediaId") REFERENCES "media"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "videos" ADD CONSTRAINT "videos_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "media"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "videos" ADD CONSTRAINT "videos_posterMediaId_fkey" FOREIGN KEY ("posterMediaId") REFERENCES "media"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "subsidiaries" ADD CONSTRAINT "subsidiaries_logoMediaId_fkey" FOREIGN KEY ("logoMediaId") REFERENCES "media"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "subsidiaries" ADD CONSTRAINT "subsidiaries_imageMediaId_fkey" FOREIGN KEY ("imageMediaId") REFERENCES "media"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "testimonials" ADD CONSTRAINT "testimonials_photoMediaId_fkey" FOREIGN KEY ("photoMediaId") REFERENCES "media"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "posts" ADD CONSTRAINT "posts_coverMediaId_fkey" FOREIGN KEY ("coverMediaId") REFERENCES "media"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "seo_meta" ADD CONSTRAINT "seo_meta_ogImageId_fkey" FOREIGN KEY ("ogImageId") REFERENCES "media"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "media_refs" ADD CONSTRAINT "media_refs_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "media"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "offices" ADD CONSTRAINT "offices_subsidiaryId_fkey" FOREIGN KEY ("subsidiaryId") REFERENCES "subsidiaries"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "menu_items" ADD CONSTRAINT "menu_items_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "pages"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "hero_slides" ADD CONSTRAINT "hero_slides_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "hero_slides" ADD CONSTRAINT "hero_slides_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "contact_messages" ADD CONSTRAINT "contact_messages_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "contact_message_notes" ADD CONSTRAINT "contact_message_notes_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Singleton settings row
ALTER TABLE "site_settings" ADD CONSTRAINT "site_settings_singleton" CHECK ("id" = 'singleton');

-- At most one primary CEO / leader message (live rows only)
CREATE UNIQUE INDEX "leader_messages_one_primary" ON "leader_messages" ("isPrimary") WHERE "isPrimary" AND "deletedAt" IS NULL;

-- Trigram indexes for typo-tolerant search
CREATE INDEX "brands_name_trgm_idx" ON "brands" USING GIN ("name" gin_trgm_ops);
CREATE INDEX "posts_title_trgm_idx" ON "posts" USING GIN ("title" gin_trgm_ops);
CREATE INDEX "services_title_trgm_idx" ON "services" USING GIN ("title" gin_trgm_ops);
CREATE INDEX "products_title_trgm_idx" ON "products" USING GIN ("title" gin_trgm_ops);
CREATE INDEX "products_search_idx" ON "products" USING GIN ("searchVector");

-- Product search vector, refreshed by trigger (joins brand and category names)
CREATE OR REPLACE FUNCTION products_refresh_search() RETURNS trigger AS $$
DECLARE
  brand_name text;
  category_name text;
BEGIN
  SELECT b.name INTO brand_name FROM brands b WHERE b.id = NEW."brandId";
  SELECT c.name INTO category_name FROM product_categories c WHERE c.id = NEW."categoryId";
  NEW."searchVector" :=
    setweight(to_tsvector('simple', unaccent(NEW.title)), 'A') ||
    setweight(to_tsvector('simple', unaccent(coalesce(NEW."shortDescription", ''))), 'B') ||
    setweight(to_tsvector('simple', unaccent(coalesce(brand_name, '') || ' ' || coalesce(category_name, '') || ' ' || coalesce(NEW."countryName", ''))), 'B') ||
    setweight(to_tsvector('simple', unaccent(regexp_replace(NEW."contentHtml", '<[^>]+>', ' ', 'g'))), 'C');
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

CREATE TRIGGER "products_search_trg" BEFORE INSERT OR UPDATE OF "title", "shortDescription", "brandId", "categoryId", "countryName", "contentHtml" ON "products"
  FOR EACH ROW EXECUTE FUNCTION products_refresh_search();

-- Renaming a brand or category refreshes the search vectors of its products
CREATE OR REPLACE FUNCTION brands_refresh_products_search() RETURNS trigger AS $$
BEGIN
  UPDATE products SET title = products.title WHERE "brandId" = NEW.id;
  RETURN NEW;
END
$$ LANGUAGE plpgsql;
CREATE TRIGGER "brands_name_search_trg" AFTER UPDATE OF "name" ON "brands"
  FOR EACH ROW EXECUTE FUNCTION brands_refresh_products_search();

CREATE OR REPLACE FUNCTION categories_refresh_products_search() RETURNS trigger AS $$
BEGIN
  UPDATE products SET title = products.title WHERE "categoryId" = NEW.id;
  RETURN NEW;
END
$$ LANGUAGE plpgsql;
CREATE TRIGGER "categories_name_search_trg" AFTER UPDATE OF "name" ON "product_categories"
  FOR EACH ROW EXECUTE FUNCTION categories_refresh_products_search();
