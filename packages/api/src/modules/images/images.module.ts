import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ImagesController } from './images.controller';
import { ImagesService } from './images.service';
import { HfVisionService } from './processors/hf-vision.service';
import { FirebaseStorageService } from './processors/firebase-storage.service';
import { LocalStorageService } from './processors/local-storage.service';
import { STORAGE_SERVICE } from './storage.constants';



@Module({
    controllers: [ImagesController],
    providers: [
        ImagesService,
        HfVisionService,
        LocalStorageService,
        {
            provide: STORAGE_SERVICE,
            useFactory: (config: ConfigService, local: LocalStorageService) => {
                const hasFirebase = Boolean(
                    config.get<string>('firebase.clientEmail') &&
                    config.get<string>('firebase.privateKey'),
                );
                if (hasFirebase) {
                    console.log('☁️  Storage: Firebase');
                    // Only instantiate Firebase when credentials exist
                    return new FirebaseStorageService(config);
                }
                console.log('📁 Storage: Local filesystem (Firebase credentials not set)');
                return local;
            },
            inject: [ConfigService, LocalStorageService],
        },
    ],
    exports: [ImagesService, HfVisionService],
})
export class ImagesModule { }
