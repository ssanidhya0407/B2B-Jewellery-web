import { Module } from '@nestjs/common';
import { NegotiationsInternalController, NegotiationsBuyerController } from './negotiations.controller';
import { NegotiationsService } from './negotiations.service';

@Module({
    controllers: [NegotiationsInternalController, NegotiationsBuyerController],
    providers: [NegotiationsService],
    exports: [NegotiationsService],
})
export class NegotiationsModule { }
