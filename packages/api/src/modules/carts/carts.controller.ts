import {
    Controller,
    Get,
    Post,
    Put,
    Delete,
    Param,
    Body,
} from '@nestjs/common';
import { User } from '@prisma/client';
import { CartsService } from './carts.service';
import { CurrentUser } from '../../common/decorators';
import { CreateCartDto, AddCartItemDto, UpdateCartItemDto, SubmitCartDto } from './dto';

@Controller('carts')
export class CartsController {
    constructor(private readonly cartsService: CartsService) { }

    @Post()
    async createCart(
        @Body() createCartDto: CreateCartDto,
        @CurrentUser() user: User,
    ) {
        return this.cartsService.create(user.id, createCartDto);
    }

    @Get()
    async listCarts(@CurrentUser() user: User) {
        return this.cartsService.findUserCarts(user.id);
    }

    @Get('draft')
    async getDraftCart(@CurrentUser() user: User) {
        return this.cartsService.getOrCreateDraftCart(user.id);
    }

    @Get(':id')
    async getCart(@Param('id') cartId: string, @CurrentUser() user: User) {
        return this.cartsService.findById(cartId, user.id);
    }

    @Post(':id/items')
    async addItem(
        @Param('id') cartId: string,
        @Body() addItemDto: AddCartItemDto,
        @CurrentUser() user: User,
    ) {
        return this.cartsService.addItem(cartId, user.id, addItemDto);
    }

    @Put(':id/items/:itemId')
    async updateItem(
        @Param('id') cartId: string,
        @Param('itemId') itemId: string,
        @Body() updateItemDto: UpdateCartItemDto,
        @CurrentUser() user: User,
    ) {
        return this.cartsService.updateItem(cartId, itemId, user.id, updateItemDto);
    }

    @Delete(':id/items/:itemId')
    async removeItem(
        @Param('id') cartId: string,
        @Param('itemId') itemId: string,
        @CurrentUser() user: User,
    ) {
        return this.cartsService.removeItem(cartId, itemId, user.id);
    }

    @Post(':id/submit')
    async submitCart(
        @Param('id') cartId: string,
        @Body() submitCartDto: SubmitCartDto,
        @CurrentUser() user: User,
    ) {
        return this.cartsService.submit(cartId, user.id, submitCartDto);
    }
}
