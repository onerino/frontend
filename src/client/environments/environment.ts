
/**
 * 環境変数dev
 */
export const environment = {
    production: false,
    APP_PREFIX: 'OY',
    PROJECT_ID: 'oyatsu',
    ENV: 'development',
    ENTRANCE_SERVER_URL: '',
    WAITER_SERVER_URL: '',
    VIEW_TYPE: 'event',
    ANALYTICS_ID: '',
    STORAGE_NAME: 'OYATSU-FRONTEND-STATE',
    STORAGE_TYPE: 'sessionStorage',
    BASE_URL: '/purchase/root',
    HEADER_MENU: true,
    HEADER_MENU_SCOPE: ['purchase', 'inquiry'],
    PURCHASE_CART_MAX_LENGTH: '10',
    PURCHASE_TRANSACTION_TIME: '15',
    PURCHASE_PRE_SCHEDULE_DATE: '3',
    PURCHASE_SCHEDULE_STATUS_THRESHOLD_VALUE: '30',
    PURCHASE_SCHEDULE_STATUS_THRESHOLD_UNIT: '%',
    INQUIRY_CANCEL: false,
    INQUIRY_QRCODE: false,
    INQUIRY_PRINT: false,
    PRINT_QR_CODE_FILTER_SUPER_EVENT_ID: ['40599yijukxxvts'],
    PRINT_QR_CODE_TYPE: 'encryption'
};
