import {
    Injectable,
    UnauthorizedException,
    ConflictException,
    BadRequestException,
} from '@nestjs/common';
import { UserType } from '@prisma/client';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ActivateInternalDto } from './dto/activate-internal.dto';

@Injectable()
export class AuthService {
    constructor(
        private readonly usersService: UsersService,
        private readonly jwtService: JwtService,
    ) { }

    async register(registerDto: RegisterDto) {
        // Check if user already exists
        const existingUser = await this.usersService.findByEmail(registerDto.email);
        if (existingUser) {
            throw new ConflictException('User with this email already exists');
        }

        // Hash password
        const passwordHash = await bcrypt.hash(registerDto.password, 10);

        // Create user
        const user = await this.usersService.create({
            email: registerDto.email,
            passwordHash,
            userType: UserType.external,
            companyName: registerDto.companyName,
            firstName: registerDto.firstName,
            lastName: registerDto.lastName,
            phone: registerDto.phone,
        });

        // Generate tokens
        const tokens = await this.generateTokens(user.id, user.email, user.userType);

        return {
            user: {
                id: user.id,
                email: user.email,
                userType: user.userType,
                companyName: user.companyName,
                firstName: user.firstName,
                lastName: user.lastName,
            },
            ...tokens,
        };
    }

    async login(loginDto: LoginDto) {
        const user = await this.usersService.findByEmail(loginDto.email);
        if (!user) {
            throw new UnauthorizedException('Invalid credentials');
        }

        const isPasswordValid = await bcrypt.compare(loginDto.password, user.passwordHash);
        if (!isPasswordValid) {
            throw new UnauthorizedException('Invalid credentials');
        }

        if (!user.isActive) {
            throw new UnauthorizedException('Account is disabled');
        }

        const tokens = await this.generateTokens(user.id, user.email, user.userType);

        return {
            user: {
                id: user.id,
                email: user.email,
                userType: user.userType,
                companyName: user.companyName,
                firstName: user.firstName,
                lastName: user.lastName,
            },
            ...tokens,
        };
    }

    async refreshToken(refreshToken: string) {
        try {
            const payload = this.jwtService.verify(refreshToken);
            const user = await this.usersService.findById(payload.sub);

            if (!user || !user.isActive) {
                throw new UnauthorizedException('Invalid refresh token');
            }

            return this.generateTokens(user.id, user.email, user.userType);
        } catch {
            throw new UnauthorizedException('Invalid refresh token');
        }
    }

    createInternalActivationToken(userId: string, email: string, userType: UserType) {
        return this.jwtService.sign(
            {
                sub: userId,
                email,
                userType,
                purpose: 'internal_activation',
            },
            { expiresIn: '7d' },
        );
    }

    async activateInternalInvite(dto: ActivateInternalDto) {
        try {
            const payload = this.jwtService.verify(dto.token) as {
                sub: string;
                email: string;
                userType: UserType;
                purpose?: string;
            };

            if (payload.purpose !== 'internal_activation') {
                throw new UnauthorizedException('Invalid activation token');
            }

            if (payload.userType === UserType.external) {
                throw new UnauthorizedException('Invalid activation token');
            }

            const user = await this.usersService.findById(payload.sub);
            if (!user || user.email !== payload.email) {
                throw new UnauthorizedException('Invalid activation token');
            }

            if (user.userType === UserType.external) {
                throw new UnauthorizedException('Invalid activation token');
            }

            if (user.isActive) {
                throw new ConflictException('Invitation already accepted');
            }

            const passwordHash = await bcrypt.hash(dto.password, 10);
            const activatedUser = await this.usersService.update(user.id, {
                passwordHash,
                isActive: true,
                firstName: dto.firstName ?? user.firstName ?? undefined,
                lastName: dto.lastName ?? user.lastName ?? undefined,
            });

            const tokens = await this.generateTokens(
                activatedUser.id,
                activatedUser.email,
                activatedUser.userType,
            );

            return {
                user: {
                    id: activatedUser.id,
                    email: activatedUser.email,
                    userType: activatedUser.userType,
                    companyName: activatedUser.companyName,
                    firstName: activatedUser.firstName,
                    lastName: activatedUser.lastName,
                },
                ...tokens,
            };
        } catch (error) {
            if (error instanceof ConflictException || error instanceof UnauthorizedException) {
                throw error;
            }
            throw new BadRequestException('Invalid activation request');
        }
    }

    private async generateTokens(userId: string, email: string, userType: string) {
        const payload = { sub: userId, email, userType };

        const accessToken = this.jwtService.sign(payload);
        const refreshToken = this.jwtService.sign(payload, { expiresIn: '30d' });

        return {
            accessToken,
            refreshToken,
        };
    }
}
