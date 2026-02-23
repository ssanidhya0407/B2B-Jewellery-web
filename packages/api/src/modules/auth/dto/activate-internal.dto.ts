import { IsOptional, IsString, MinLength } from 'class-validator';

export class ActivateInternalDto {
    @IsString()
    token: string;

    @IsString()
    @MinLength(8)
    password: string;

    @IsOptional()
    @IsString()
    firstName?: string;

    @IsOptional()
    @IsString()
    lastName?: string;
}
