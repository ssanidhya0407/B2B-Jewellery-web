import Cookies from 'js-cookie';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface ApiOptions {
    method?: string;
    body?: unknown;
    headers?: Record<string, string>;
}

class DashboardApiClient {
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

    // Auth
    async login(data: { email: string; password: string }) {
        return this.request<{ accessToken: string; refreshToken: string; user: unknown }>(
            '/auth/login',
            { method: 'POST', body: data }
        );
    }

    // Quotations / Sales
    async getSubmittedRequests() {
        return this.request('/internal/quotations/requests');
    }

    async getRequestDetails(cartId: string) {
        return this.request(`/internal/quotations/requests/${cartId}`);
    }

    async updateRequestStatus(cartId: string, status: string) {
        return this.request(`/internal/quotations/requests/${cartId}/status`, {
            method: 'PUT',
            body: { status },
        });
    }

    async createQuotation(data: { cartId: string; items: Array<{ cartItemId: string; finalUnitPrice: number }> }) {
        return this.request('/internal/quotations', { method: 'POST', body: data });
    }

    async sendQuotation(quotationId: string) {
        return this.request(`/internal/quotations/${quotationId}/send`, { method: 'POST' });
    }

    // Admin
    async listInventory() {
        return this.request('/admin/inventory');
    }

    async createInventory(data: Record<string, unknown>) {
        return this.request('/admin/inventory', { method: 'POST', body: data });
    }

    async updateInventory(id: string, data: Record<string, unknown>) {
        return this.request(`/admin/inventory/${id}`, { method: 'PUT', body: data });
    }

    async deleteInventory(id: string) {
        return this.request(`/admin/inventory/${id}`, { method: 'DELETE' });
    }

    async listUsers() {
        return this.request('/admin/users');
    }

    async updateUser(id: string, data: { isActive?: boolean; userType?: string }) {
        return this.request(`/admin/users/${id}`, { method: 'PUT', body: data });
    }

    async inviteInternalUser(data: {
        email: string;
        userType: 'sales' | 'operations' | 'admin';
        firstName?: string;
        lastName?: string;
    }) {
        return this.request<{
            invitedUser: { id: string; email: string; userType: string };
            activationLink: string;
            expiresIn: string;
        }>('/admin/users/invite', {
            method: 'POST',
            body: data,
        });
    }

    async getMargins() {
        return this.request('/admin/margins');
    }

    async createMargin(data: Record<string, unknown>) {
        return this.request('/admin/margins', { method: 'POST', body: data });
    }

    async updateMargin(id: string, data: Record<string, unknown>) {
        return this.request(`/admin/margins/${id}`, { method: 'PUT', body: data });
    }

    // ─── Operations ───────────────────────────────────────────────

    // Inventory Management (Operations)
    async getOpsInventory(filters?: { category?: string; search?: string; isActive?: string }) {
        const params = new URLSearchParams();
        if (filters?.category) params.set('category', filters.category);
        if (filters?.search) params.set('search', filters.search);
        if (filters?.isActive !== undefined && filters.isActive !== '') params.set('isActive', filters.isActive);
        const query = params.toString();
        return this.request(`/operations/inventory${query ? `?${query}` : ''}`);
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

    async approveProduct(inventoryId: string) {
        return this.request(`/operations/products/${inventoryId}/approve`, { method: 'POST' });
    }

    async rejectProduct(inventoryId: string, reason: string) {
        return this.request(`/operations/products/${inventoryId}/reject`, { method: 'POST', body: { reason } });
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

    async updateProcurementStatus(id: string, status: string, cost?: number) {
        return this.request(`/operations/procurement/${id}/status`, { method: 'PUT', body: { status, cost } });
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

    // ─── Notifications ───────────────────────────────────────────
    async getNotifications(page = 1) {
        return this.request(`/notifications?page=${page}`);
    }

    async markNotificationRead(id: string) {
        return this.request(`/notifications/${id}/read`, { method: 'POST' });
    }

    async markAllNotificationsRead() {
        return this.request('/notifications/read-all', { method: 'POST' });
    }
}

export const dashboardApi = new DashboardApiClient(API_URL);
