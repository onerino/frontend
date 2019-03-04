import { ViewType } from '../app/models';

/**
 * 環境変数dev
 */
export const environment = {
    production: false,

    APP_PREFIX: 'OY',
    PROJECT_ID: 'oyatsu',
    ENV: 'development',

    API_ENDPOINT: 'https://oyatsu-cinerino-api-dev.appspot.com',

    ENTRANCE_SERVER_URL: '',
    // WAITER_SERVER_URL: 'https://waiter-development.appspot.com',
    WAITER_SERVER_URL: '',

    ANALYTICS_ID: '',

    LIMITED_PURCHASE_COUNT: '1',

    VIEW_TYPE: ViewType.Cinema,

    TRANSACTION_TIME: '15',
    PRE_SCHEDULE_DATE: '3',

    STORAGE_NAME: 'OYATSU-FRONTEND-STATE'
};
