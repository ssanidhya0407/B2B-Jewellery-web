import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class NotificationsService {
    constructor(private prisma: PrismaService) {}

    async create(data: {
        userId: string;
        title: string;
        message: string;
        type: string;
        link?: string;
    }) {
        return this.prisma.notification.create({
            data: {
                userId: data.userId,
                title: data.title,
                message: data.message,
                type: data.type,
                link: data.link,
            },
        });
    }

    async getForUser(userId: string, page = 1, limit = 20) {
        const skip = (page - 1) * limit;
        const [notifications, total, unreadCount] = await Promise.all([
            this.prisma.notification.findMany({
                where: { userId },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
            }),
            this.prisma.notification.count({ where: { userId } }),
            this.prisma.notification.count({ where: { userId, isRead: false } }),
        ]);

        return {
            notifications,
            unreadCount,
            total,
            page,
            totalPages: Math.ceil(total / limit),
        };
    }

    async markAsRead(id: string, userId: string) {
        return this.prisma.notification.updateMany({
            where: { id, userId },
            data: { isRead: true },
        });
    }

    async markAllAsRead(userId: string) {
        return this.prisma.notification.updateMany({
            where: { userId, isRead: false },
            data: { isRead: true },
        });
    }

    async notifyQuoteSent(userId: string, quotationId: string, cartId: string) {
        return this.create({
            userId,
            title: 'New Quote Received',
            message: 'A formal quotation has been prepared for your request. Please review and respond within 48 hours.',
            type: 'quote_sent',
            link: `/app/quotations`,
        });
    }

    async notifyQuoteExpired(userId: string, quotationId: string) {
        return this.create({
            userId,
            title: 'Quote Expired',
            message: 'Your quotation has expired. Contact your sales representative to request a new one.',
            type: 'quote_expired',
        });
    }

    async notifyOrderCreated(userId: string, orderId: string, orderNumber: string) {
        return this.create({
            userId,
            title: 'Order Confirmed',
            message: `Your order #${orderNumber} has been created. Proceed to payment to confirm.`,
            type: 'order_created',
            link: `/app/orders`,
        });
    }

    async notifyPaymentReceived(userId: string, orderId: string, orderNumber: string) {
        return this.create({
            userId,
            title: 'Payment Confirmed',
            message: `Payment for order #${orderNumber} has been confirmed.`,
            type: 'payment_confirmed',
            link: `/app/orders`,
        });
    }

    async notifyShipmentUpdate(userId: string, orderId: string, status: string) {
        return this.create({
            userId,
            title: 'Shipment Update',
            message: `Your shipment status has been updated to: ${status}`,
            type: 'shipment_update',
            link: `/app/orders`,
        });
    }

    async notifyNewRequest(salesPersonId: string, cartId: string, buyerName: string) {
        return this.create({
            userId: salesPersonId,
            title: 'New Quote Request',
            message: `${buyerName} has submitted a new quote request.`,
            type: 'new_request',
            link: `/requests/${cartId}`,
        });
    }

    async notifyQuoteAccepted(salesPersonId: string, quotationId: string, buyerName: string) {
        return this.create({
            userId: salesPersonId,
            title: 'Quote Accepted',
            message: `${buyerName} has accepted your quotation.`,
            type: 'quote_accepted',
        });
    }
}
