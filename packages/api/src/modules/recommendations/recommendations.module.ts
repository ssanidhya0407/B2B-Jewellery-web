import { Module } from '@nestjs/common';
import { RecommendationsController } from './recommendations.controller';
import { RecommendationsService } from './recommendations.service';
import { InventoryMatcherService } from './engines/inventory-matcher.service';
import { ManufacturerMatcherService } from './engines/manufacturer-matcher.service';
import { PricingEngineService } from './engines/pricing-engine.service';
import { ImagesModule } from '../images/images.module';

@Module({
    imports: [ImagesModule],
    controllers: [RecommendationsController],
    providers: [
        RecommendationsService,
        InventoryMatcherService,
        ManufacturerMatcherService,
        PricingEngineService,
    ],
    exports: [RecommendationsService],
})
export class RecommendationsModule { }
