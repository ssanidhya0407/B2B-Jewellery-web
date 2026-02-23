import { Type } from 'class-transformer';
import { IsIn, IsNotEmpty, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';

const CATEGORY_OPTIONS = [
    'ring',
    'necklace',
    'earring',
    'earrings', // backward-compatible alias
    'bracelet',
    'pendant',
    'bangle',
    'other',
] as const;

export class UploadImageDto {
    @IsString()
    @IsNotEmpty()
    @IsIn(CATEGORY_OPTIONS)
    category!: (typeof CATEGORY_OPTIONS)[number];

    @IsOptional()
    @IsString()
    @MaxLength(1000)
    context?: string;

    /**
     * Buyer-provided maximum unit price (used to constrain external sourcing).
     */
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(0)
    maxUnitPrice?: number;
}

