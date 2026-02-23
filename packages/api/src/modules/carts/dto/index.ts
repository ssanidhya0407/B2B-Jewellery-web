import { IsString, IsOptional, IsUUID, IsInt, Min } from 'class-validator';

export class CreateCartDto {
    @IsOptional()
    @IsUUID()
    sessionId?: string;

    @IsOptional()
    @IsString()
    notes?: string;
}

export class AddCartItemDto {
    @IsUUID()
    recommendationItemId: string;

    @IsOptional()
    @IsInt()
    @Min(1)
    quantity?: number;

    @IsOptional()
    @IsString()
    notes?: string;
}

export class UpdateCartItemDto {
    @IsOptional()
    @IsInt()
    @Min(1)
    quantity?: number;

    @IsOptional()
    @IsString()
    notes?: string;
}

export class SubmitCartDto {
    @IsOptional()
    @IsString()
    preferredDeliveryDate?: string;

    @IsOptional()
    @IsString()
    customizationRequirements?: string;

    @IsOptional()
    @IsString()
    businessUseCase?: string;

    @IsOptional()
    @IsString()
    urgency?: string;

    @IsOptional()
    @IsString()
    additionalNotes?: string;
}
