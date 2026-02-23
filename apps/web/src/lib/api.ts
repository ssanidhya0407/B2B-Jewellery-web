import Cookies from 'js-cookie';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface ApiOptions {
    method?: string;
    body?: unknown;
    headers?: Record<string, string>;
}

class ApiClient {
    private baseUrl: string;

    constructor(baseUrl: string) {
        this.baseUrl = baseUrl;
    }

    private getAuthHeaders(): Record<string, string> {
        const token = Cookies.get('accessToken');
        return token ? { Authorization: `Bearer ${token}` } : {};
    }

    async request<T>(endpoint: string, options: ApiOptions = {}): Promise<T> {
        const { method = 'GET', body, headers = {} } = options;

        const config: RequestInit = {
            method,
            headers: {
                'Content-Type': 'application/json',
                ...this.getAuthHeaders(),
                ...headers,
            },
        };

        if (body) {
            config.body = JSON.stringify(body);
        }

        const response = await fetch(`${this.baseUrl}/api${endpoint}`, config);

        if (!response.ok) {
            const error = await response.json().catch(() => ({ message: 'Request failed' }));
            throw new Error(error.message || `HTTP ${response.status}`);
        }

        return response.json();
    }

    async uploadImage(
        file: File,
        data: { category: string; context?: string; maxUnitPrice?: number },
    ): Promise<{ sessionId: string }> {
        const formData = new FormData();
        formData.append('image', file);
        formData.append('category', data.category);
        if (data.context) formData.append('context', data.context);
        if (data.maxUnitPrice !== undefined) formData.append('maxUnitPrice', String(data.maxUnitPrice));

        const token = Cookies.get('accessToken');
        const response = await fetch(`${this.baseUrl}/api/images/upload`, {
            method: 'POST',
            headers: token ? { Authorization: `Bearer ${token}` } : {},
            body: formData,
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ message: 'Upload failed' }));
            throw new Error(error.message);
        }

        return response.json();
    }

    // Auth
    async register(data: {
        email: string;
        password: string;
        companyName?: string;
        firstName?: string;
        lastName?: string;
        phone?: string;
        userType?: 'external' | 'sales' | 'operations' | 'admin';
    }) {
        return this.request('/auth/register', { method: 'POST', body: data });
    }

    async login(data: { email: string; password: string }) {
        return this.request<{ accessToken: string; refreshToken: string; user: unknown }>(
            '/auth/login',
            { method: 'POST', body: data }
        );
    }

    async activateInternalInvite(data: {
        token: string;
        password: string;
        firstName?: string;
        lastName?: string;
    }) {
        return this.request<{ accessToken: string; refreshToken: string; user: unknown }>(
            '/auth/activate-internal',
            { method: 'POST', body: data }
        );
    }

    // Sessions
    async getSession(sessionId: string) {
        return this.request(`/images/session/${sessionId}`);
    }

    async getUserSessions() {
        return this.request('/images/sessions');
    }

    // Recommendations
    async getRecommendations(sessionId: string) {
        return this.request(`/recommendations/${sessionId}`);
    }

    // Carts
    async createCart(data: { sessionId?: string; notes?: string }) {
        return this.request('/carts', { method: 'POST', body: data });
    }

    async getCarts() {
        return this.request('/carts');
    }

    async getCart(cartId: string) {
        return this.request(`/carts/${cartId}`);
    }

    async addCartItem(cartId: string, data: { recommendationItemId: string; quantity?: number; notes?: string }) {
        return this.request(`/carts/${cartId}/items`, { method: 'POST', body: data });
    }

    async updateCartItem(cartId: string, itemId: string, data: { quantity?: number; notes?: string }) {
        return this.request(`/carts/${cartId}/items/${itemId}`, { method: 'PUT', body: data });
    }

    async removeCartItem(cartId: string, itemId: string) {
        return this.request(`/carts/${cartId}/items/${itemId}`, { method: 'DELETE' });
    }

    async submitCart(cartId: string, data?: {
        preferredDeliveryDate?: string;
        customizationRequirements?: string;
        businessUseCase?: string;
        urgency?: string;
        additionalNotes?: string;
    }) {
        return this.request(`/carts/${cartId}/submit`, { method: 'POST', body: data || {} });
    }

    async getDraftCart() {
        return this.request('/carts/draft');
    }

    // Admin
    async getUsers() {
        return this.request('/admin/users');
    }

    async inviteUser(data: {
        email: string;
        userType: 'sales' | 'operations' | 'admin';
        firstName?: string;
        lastName?: string;
    }) {
        return this.request('/admin/users/invite', { method: 'POST', body: data });
    }

    async updateUser(userId: string, data: { isActive?: boolean; userType?: string }) {
        return this.request(`/admin/users/${userId}`, { method: 'PUT', body: data });
    }

    // Quotations (internal ops)
    async getQuoteRequests() {
        return this.request('/internal/quotations/requests');
    }

    async getQuoteRequest(cartId: string) {
        return this.request(`/internal/quotations/requests/${cartId}`);
    }

    async updateRequestStatus(cartId: string, status: string) {
        return this.request(`/internal/quotations/requests/${cartId}/status`, { method: 'PUT', body: { status } });
    }

    async createQuotation(data: { cartId: string; items: Array<{ cartItemId: string; finalUnitPrice: number }> }) {
        return this.request('/internal/quotations', { method: 'POST', body: data });
    }

    async sendQuotation(quotationId: string) {
        return this.request(`/internal/quotations/${quotationId}/send`, { method: 'POST' });
    }

    // ─── Buyer: Quotations & Orders ─────────────────────────────
    async getMyQuotations() {
        return this.request('/orders/my-quotations');
    }

    async getQuotation(quotationId: string) {
        return this.request(`/orders/quotations/${quotationId}`);
    }

    async acceptQuotation(quotationId: string) {
        return this.request(`/orders/quotations/${quotationId}/accept`, { method: 'POST' });
    }

    async rejectQuotation(quotationId: string, reason?: string) {
        return this.request(`/orders/quotations/${quotationId}/reject`, { method: 'POST', body: { reason } });
    }

    async getMyOrders() {
        return this.request('/orders');
    }

    async getOrder(orderId: string) {
        return this.request(`/orders/${orderId}`);
    }

    async initiatePayment(orderId: string, data: { method: 'card' | 'bank_transfer' | 'upi'; amount: number; transactionRef?: string }) {
        return this.request(`/orders/${orderId}/pay`, { method: 'POST', body: data });
    }

    // Notifications
    async getNotifications(page = 1) {
        return this.request(`/notifications?page=${page}`);
    }

    async markNotificationRead(id: string) {
        return this.request(`/notifications/${id}/read`, { method: 'POST' });
    }

    async markAllNotificationsRead() {
        return this.request('/notifications/read-all', { method: 'POST' });
    }

    // ─── Operations ───────────────────────────────────────────────
    async getOperationsDashboard() {
        return this.request('/operations/dashboard');
    }

    async getSystemHealth() {
        return this.request('/operations/health');
    }

    async getMarkupConfigs() {
        return this.request('/operations/markups');
    }

    async upsertMarkup(data: { category?: string; sourceType?: string; markupPercent: number }) {
        return this.request('/operations/markups', { method: 'POST', body: data });
    }

    async getScraperConfig() {
        return this.request('/operations/scraper-config');
    }

    async updateScraperConfig(config: Record<string, unknown>) {
        return this.request('/operations/scraper-config', { method: 'PUT', body: { config } });
    }

    async getSuppliers() {
        return this.request('/operations/suppliers');
    }

    async createSupplier(data: Record<string, unknown>) {
        return this.request('/operations/suppliers', { method: 'POST', body: data });
    }

    async updateSupplier(id: string, data: Record<string, unknown>) {
        return this.request(`/operations/suppliers/${id}`, { method: 'PUT', body: data });
    }

    async getPendingProducts() {
        return this.request('/operations/pending-products');
    }

    async approveProduct(type: 'inventory' | 'manufacturer', id: string) {
        return this.request(`/operations/products/${type}/${id}/approve`, { method: 'POST' });
    }

    async rejectProduct(type: 'inventory' | 'manufacturer', id: string) {
        return this.request(`/operations/products/${type}/${id}/reject`, { method: 'POST' });
    }

    async getOpsOrders(status?: string) {
        const query = status ? `?status=${status}` : '';
        return this.request(`/operations/orders${query}`);
    }

    async updateOrderStatus(orderId: string, status: string) {
        return this.request(`/operations/orders/${orderId}/status`, { method: 'PUT', body: { status } });
    }

    async createProcurement(data: Record<string, unknown>) {
        return this.request('/operations/procurement', { method: 'POST', body: data });
    }

    async createShipment(data: Record<string, unknown>) {
        return this.request('/operations/shipments', { method: 'POST', body: data });
    }

    async updateShipmentStatus(id: string, status: string, trackingNumber?: string) {
        return this.request(`/operations/shipments/${id}/status`, { method: 'PUT', body: { status, trackingNumber } });
    }

    async confirmBankPayment(paymentId: string) {
        return this.request(`/operations/payments/${paymentId}/confirm`, { method: 'POST' });
    }

    // ─── Ops Inventory ────────────────────────────────────────────
    async getOpsInventory(filters?: { category?: string; search?: string; isActive?: string }) {
        const params = new URLSearchParams();
        if (filters?.category) params.set('category', filters.category);
        if (filters?.search) params.set('search', filters.search);
        if (filters?.isActive) params.set('isActive', filters.isActive);
        const query = params.toString() ? `?${params.toString()}` : '';
        return this.request(`/operations/inventory${query}`);
    }

    async getOpsInventoryStats() {
        return this.request('/operations/inventory/stats');
    }

    async getOpsInventoryItem(id: string) {
        return this.request(`/operations/inventory/${id}`);
    }

    async createOpsInventory(data: Record<string, unknown>) {
        return this.request('/operations/inventory', { method: 'POST', body: data });
    }

    async updateOpsInventory(id: string, data: Record<string, unknown>) {
        return this.request(`/operations/inventory/${id}`, { method: 'PUT', body: data });
    }

    async deleteOpsInventory(id: string) {
        return this.request(`/operations/inventory/${id}`, { method: 'DELETE' });
    }

    // ─── Ops Manufacturer Catalog ─────────────────────────────────
    async getOpsManufacturer(filters?: { category?: string; search?: string; isVerified?: string }) {
        const params = new URLSearchParams();
        if (filters?.category) params.set('category', filters.category);
        if (filters?.search) params.set('search', filters.search);
        if (filters?.isVerified) params.set('isVerified', filters.isVerified);
        const query = params.toString() ? `?${params.toString()}` : '';
        return this.request(`/operations/manufacturer${query}`);
    }

    async getOpsManufacturerStats() {
        return this.request('/operations/manufacturer/stats');
    }

    async getOpsManufacturerItem(id: string) {
        return this.request(`/operations/manufacturer/${id}`);
    }

    async createOpsManufacturer(data: Record<string, unknown>) {
        return this.request('/operations/manufacturer', { method: 'POST', body: data });
    }

    async updateOpsManufacturer(id: string, data: Record<string, unknown>) {
        return this.request(`/operations/manufacturer/${id}`, { method: 'PUT', body: data });
    }

    async deleteOpsManufacturer(id: string) {
        return this.request(`/operations/manufacturer/${id}`, { method: 'DELETE' });
    }

    // ─── Ops Alibaba Catalog ──────────────────────────────────────
    async getOpsAlibaba(filters?: { category?: string; search?: string; isVerified?: string }) {
        const params = new URLSearchParams();
        if (filters?.category) params.set('category', filters.category);
        if (filters?.search) params.set('search', filters.search);
        if (filters?.isVerified) params.set('isVerified', filters.isVerified);
        const query = params.toString() ? `?${params.toString()}` : '';
        return this.request(`/operations/alibaba${query}`);
    }

    async getOpsAlibabaStats() {
        return this.request('/operations/alibaba/stats');
    }

    async getOpsAlibabaItem(id: string) {
        return this.request(`/operations/alibaba/${id}`);
    }

    async createOpsAlibaba(data: Record<string, unknown>) {
        return this.request('/operations/alibaba', { method: 'POST', body: data });
    }

    async updateOpsAlibaba(id: string, data: Record<string, unknown>) {
        return this.request(`/operations/alibaba/${id}`, { method: 'PUT', body: data });
    }

    async deleteOpsAlibaba(id: string) {
        return this.request(`/operations/alibaba/${id}`, { method: 'DELETE' });
    }

    // ─── Combined Product Stats ───────────────────────────────────
    async getAllProductStats() {
        return this.request('/operations/products/stats');
    }

    // ─── Sales ────────────────────────────────────────────────────
    async getSalesDashboard() {
        return this.request('/sales/dashboard');
    }

    async getSalesRequestDetails(cartId: string) {
        return this.request(`/sales/requests/${cartId}`);
    }

    async checkStockAvailability(skuIds: string[]) {
        return this.request('/sales/check-stock', { method: 'POST', body: { skuIds } });
    }

    async getApplicableMarkup(category: string, sourceType: string) {
        return this.request(`/sales/markup/${encodeURIComponent(category)}/${sourceType}`);
    }

    async createSalesQuotation(data: {
        cartId: string;
        items: Array<{ inventoryItemId: string; quantity: number; unitPrice: number; notes?: string }>;
        validityHours?: number;
        terms?: string;
    }) {
        return this.request('/sales/quotations', { method: 'POST', body: data });
    }

    async sendSalesQuotation(quotationId: string) {
        return this.request(`/sales/quotations/${quotationId}/send`, { method: 'POST' });
    }

    async reviseSalesQuotation(quotationId: string, data: {
        items: Array<{ inventoryItemId: string; quantity: number; unitPrice: number; notes?: string }>;
        validityHours?: number;
        terms?: string;
    }) {
        return this.request(`/sales/quotations/${quotationId}/revise`, { method: 'PUT', body: data });
    }

    async convertToOrder(quotationId: string) {
        return this.request('/sales/convert-order', { method: 'POST', body: { quotationId } });
    }

    async getSalesMessages(cartId: string) {
        return this.request(`/sales/messages/${cartId}`);
    }

    async sendSalesMessage(cartId: string, content: string) {
        return this.request('/sales/messages', { method: 'POST', body: { cartId, content } });
    }

    async getCommissions() {
        return this.request('/sales/commissions');
    }

    async getBuyers() {
        return this.request('/sales/buyers');
    }

    // ─── Admin: Inventory ─────────────────────────────────────────
    async listInventory() {
        return this.request('/admin/inventory');
    }

    async listUsers() {
        return this.request('/admin/users');
    }

    // ─── Negotiations (Internal / Sales) ──────────────────────────
    async openNegotiation(quotationId: string, note?: string) {
        return this.request('/internal/negotiations/open', { method: 'POST', body: { quotationId, note } });
    }

    async getNegotiationByQuotation(quotationId: string) {
        return this.request(`/internal/negotiations/quotation/${quotationId}`);
    }

    async getNegotiation(negotiationId: string) {
        return this.request(`/internal/negotiations/${negotiationId}`);
    }

    async submitSellerCounter(negotiationId: string, data: {
        items: Array<{ cartItemId: string; proposedUnitPrice: number; quantity: number }>;
        message?: string;
    }) {
        return this.request(`/internal/negotiations/${negotiationId}/counter`, { method: 'POST', body: data });
    }

    async sellerAcceptNegotiation(negotiationId: string) {
        return this.request(`/internal/negotiations/${negotiationId}/accept`, { method: 'POST' });
    }

    async sellerCloseNegotiation(negotiationId: string, reason?: string) {
        return this.request(`/internal/negotiations/${negotiationId}/close`, { method: 'POST', body: { reason } });
    }

    // ─── Negotiations (Buyer) ─────────────────────────────────────
    async getBuyerNegotiation(quotationId: string) {
        return this.request(`/negotiations/quotation/${quotationId}`);
    }

    async submitBuyerCounter(negotiationId: string, data: {
        items: Array<{ cartItemId: string; proposedUnitPrice: number; quantity: number }>;
        message?: string;
    }) {
        return this.request(`/negotiations/${negotiationId}/counter`, { method: 'POST', body: data });
    }

    async buyerAcceptNegotiation(negotiationId: string) {
        return this.request(`/negotiations/${negotiationId}/accept`, { method: 'POST' });
    }

    async buyerCloseNegotiation(negotiationId: string, reason?: string) {
        return this.request(`/negotiations/${negotiationId}/close`, { method: 'POST', body: { reason } });
    }

    // ─── Manufacturer Profiles (Operations) ──────────────────────

    async getManufacturers(filters?: { search?: string; category?: string; isActive?: string; isVerified?: string }) {
        const params = new URLSearchParams();
        if (filters?.search) params.set('search', filters.search);
        if (filters?.category) params.set('category', filters.category);
        if (filters?.isActive) params.set('isActive', filters.isActive);
        if (filters?.isVerified) params.set('isVerified', filters.isVerified);
        const query = params.toString() ? `?${params.toString()}` : '';
        return this.request(`/operations/manufacturers${query}`);
    }

    async getManufacturersStats() {
        return this.request('/operations/manufacturers/stats');
    }

    async getManufacturer(id: string) {
        return this.request(`/operations/manufacturers/${id}`);
    }

    async createManufacturer(data: Record<string, unknown>) {
        return this.request('/operations/manufacturers', { method: 'POST', body: data });
    }

    async updateManufacturer(id: string, data: Record<string, unknown>) {
        return this.request(`/operations/manufacturers/${id}`, { method: 'PUT', body: data });
    }

    async deleteManufacturer(id: string) {
        return this.request(`/operations/manufacturers/${id}`, { method: 'DELETE' });
    }

    async getManufacturerProducts(manufacturerId: string, filters?: { category?: string; search?: string }) {
        const params = new URLSearchParams();
        if (filters?.category) params.set('category', filters.category);
        if (filters?.search) params.set('search', filters.search);
        const query = params.toString() ? `?${params.toString()}` : '';
        return this.request(`/operations/manufacturers/${manufacturerId}/products${query}`);
    }

    async addManufacturerProduct(manufacturerId: string, data: Record<string, unknown>) {
        return this.request(`/operations/manufacturers/${manufacturerId}/products`, { method: 'POST', body: data });
    }

    // ─── Stock Check (Operations quotation review) ────────────────

    async checkProductStock(productId: string, source: string) {
        return this.request(`/operations/stock-check/${productId}`, { method: 'POST', body: { source } });
    }

    async updateProductStockStatus(productId: string, stockStatus: string, notes?: string) {
        return this.request(`/operations/stock-status/${productId}`, { method: 'PUT', body: { stockStatus, notes } });
    }

    // ─── Quotation Workflow — Operations ──────────────────────────
    async validateCartInventory(cartId: string) {
        return this.request(`/operations/carts/${cartId}/validate-inventory`, { method: 'POST' });
    }

    async forwardToSales(cartId: string, salesPersonId: string) {
        return this.request(`/operations/carts/${cartId}/forward-to-sales`, { method: 'POST', body: { salesPersonId } });
    }

    async getSalesTeamMembers() {
        return this.request('/operations/sales-team');
    }

    // ─── Quotation Workflow — Sales ───────────────────────────────
    async getAssignedRequests() {
        return this.request('/sales/assigned-requests');
    }

    async requestBalancePayment(orderId: string) {
        return this.request(`/sales/orders/${orderId}/request-balance`, { method: 'POST' });
    }

    async calculateCommissionForOrder(orderId: string) {
        return this.request(`/sales/orders/${orderId}/calculate-commission`, { method: 'POST' });
    }

    async getQuotationTracker(cartId: string) {
        return this.request(`/sales/tracker/${cartId}`);
    }

    // ─── Quotation Tracker — Buyer ───────────────────────────────
    async getBuyerQuotationTracker(cartId: string) {
        return this.request(`/orders/tracker/${cartId}`);
    }
}

export const api = new ApiClient(API_URL);
