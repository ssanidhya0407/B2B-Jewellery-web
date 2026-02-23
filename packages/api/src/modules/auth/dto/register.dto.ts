import {
    IsEmail,
    IsString,
    IsOptional,
    IsEnum,
    MinLength,
} from 'class-validator';
import { UserType } from '@prisma/client';

export class RegisterDto {
    @IsEmail()
    email: string;

    @IsString()
    @MinLength(8)
    password: string;

    @IsOptional()
    @IsEnum(UserType)
    userType?: UserType;

    @IsOptional()
    @IsString()
    companyName?: string;

    @IsOptional()
    @IsString()
    firstName?: string;

    @IsOptional()
    @IsString()
    lastName?: string;

    @IsOptional()
    @IsString()
    phone?: string;
}
