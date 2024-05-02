/* 
* <license header>
*/

const fireflyCscUtils = require('../actions/fireflyCscUtils.js')
const dotenv = require('dotenv');
dotenv.config({ path: '../../.env' });
const testParams = { 
  __ow_headers: { authorization: 'Bearer fake' },
  LOG_LEVEL: 'debug',
  AEM_SERVICE_TECH_ACCOUNT_CLIENT_ID: process.env.AEM_SERVICE_TECH_ACCOUNT_CLIENT_ID,
  AEM_SERVICE_TECH_ACCOUNT_ID: process.env.AEM_SERVICE_TECH_ACCOUNT_ID,
  AEM_SERVICE_TECH_ACCOUNT_CLIENT_SECRET: process.env.AEM_SERVICE_TECH_ACCOUNT_CLIENT_SECRET,
  AEM_SERVICE_TECH_ACCOUNT_ORG_ID: process.env.AEM_SERVICE_TECH_ACCOUNT_ORG_ID,
  AEM_SERVICE_TECH_ACCOUNT_PRIVATE_KEY: process.env.AEM_SERVICE_TECH_ACCOUNT_PRIVATE_KEY,
  AEM_SERVICE_TECH_ACCOUNT_META_SCOPES: process.env.AEM_SERVICE_TECH_ACCOUNT_META_SCOPES,
  AEM_USE_PASSED_AUTH: process.env.GET_AEM_ASSET_DATA__AEM_USE_PASSED_AUTH,
  FIREFLY_SERVICES_ORG_ID: process.env.FIREFLY_SERVICES_ORG_ID,
  FIREFLY_SERVICES_CLIENT_ID: process.env.FIREFLY_SERVICES_CLIENT_ID,
  FIREFLY_SERVICES_USE_PASSED_AUTH: process.env.FIREFLY_SERVICES__USE_PASSED_AUTH,
  FIREFLY_SERVICES_CLIENT_SECRET: process.env.FIREFLY_SERVICES_CLIENT_SECRET,
  FIREFLY_SERVICES_SCOPES: process.env.FIREFLY_SERVICES_SCOPES
 }

 jest.mock('@adobe/aio-sdk', () => ({
  Core: {
    Logger: jest.fn()
  }
}))

const { Core } = require('@adobe/aio-sdk')
const mockLoggerInstance = { info: jest.fn(), debug: jest.fn(), error: jest.fn() }
Core.Logger.mockReturnValue(mockLoggerInstance)

beforeEach(() => {
  Core.Logger.mockClear()
  mockLoggerInstance.info.mockReset()
  mockLoggerInstance.debug.mockReset()
  mockLoggerInstance.error.mockReset()
})

